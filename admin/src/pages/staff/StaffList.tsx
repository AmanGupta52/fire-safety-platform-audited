import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Plus, Pencil, Shield, Check, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import clsx from 'clsx';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { StaffMember, Role, Permission } from '../../types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/FormControls';
import { Card, Badge } from '../../components/ui/Primitives';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';

interface RolePermissionsData {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: Record<Role, Permission[]>;
}

export default function StaffList() {
  const [editingStaff, setEditingStaff] = useState<StaffMember | 'new' | null>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const queryClient = useQueryClient();

  const { data: staffList, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await api.get('/staff')).data.data as StaffMember[]
  });

  const { data: meta } = useQuery({
    queryKey: ['staff-permissions-meta'],
    queryFn: async () => (await api.get('/staff/permissions')).data.data as RolePermissionsData
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (member: StaffMember) =>
      api.put(`/staff/${member._id}`, { isActive: !member.isActive }),
    onSuccess: () => {
      toast.success('Staff status updated');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  const columns: Column<StaffMember>[] = [
    {
      header: 'Staff Member',
      render: (s) => (
        <div>
          <p className="font-medium text-ink">{s.name}</p>
          {s.phone && <p className="text-xs text-slateink">{s.phone}</p>}
        </div>
      )
    },
    { header: 'Email', render: (s) => <span className="font-mono text-xs">{s.email}</span> },
    {
      header: 'Role',
      render: (s) => {
        const tone = s.role === 'super_admin' ? 'warning' : s.role === 'admin' ? 'info' : 'neutral';
        return <Badge tone={tone}>{s.role.replace('_', ' ')}</Badge>;
      }
    },
    {
      header: 'Permissions',
      render: (s) => {
        if (s.role === 'super_admin') {
          return <span className="text-xs text-amber font-medium flex items-center gap-1"><Shield className="h-3 w-3" /> Full Access</span>;
        }
        const overridesCount = s.permissionOverrides?.length || 0;
        return (
          <span className="text-xs text-slateink">
            {overridesCount > 0 ? `${overridesCount} custom override(s)` : 'Standard role defaults'}
          </span>
        );
      }
    },
    {
      header: 'Status',
      render: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Disabled'}</Badge>
    },
    {
      header: 'Created',
      render: (s) => <span className="text-xs text-slateink">{format(new Date(s.createdAt), 'd MMM yyyy')}</span>
    },
    {
      header: '',
      className: 'text-right',
      render: (s) => {
        const isSelf = s._id === currentUser?.id;
        const canEdit = isSuperAdmin || (s.role !== 'super_admin');
        const canToggle = isSuperAdmin && !isSelf;

        return (
          <div className="flex justify-end gap-1">
            {canEdit && (
              <button
                onClick={() => setEditingStaff(s)}
                className="rounded p-1.5 text-slateink hover:bg-paper"
                aria-label="Edit"
                title="Edit staff details"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {canToggle && (
              <Button
                variant={s.isActive ? 'danger' : 'secondary'}
                size="sm"
                onClick={() => toggleActiveMutation.mutate(s)}
                loading={toggleActiveMutation.isPending}
              >
                {s.isActive ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div>
      <PageHeader
        title="Staff & Roles"
        description="Manage internal administrative accounts, roles, and granular module permissions."
        actions={
          isSuperAdmin && (
            <Button onClick={() => setEditingStaff('new')}>
              <Plus className="h-3.5 w-3.5" /> Add Staff Account
            </Button>
          )
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={staffList || []}
          rowKey={(s) => s._id}
          isLoading={isLoading}
          emptyIcon={UserCog}
          emptyTitle="No staff accounts found"
        />
      </Card>

      {editingStaff && (
        <StaffFormModal
          staff={editingStaff === 'new' ? null : editingStaff}
          meta={meta}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditingStaff(null)}
        />
      )}
    </div>
  );
}

interface FormValues {
  name: string;
  email: string;
  phone?: string;
  role: Role;
  password?: string;
  isActive: boolean;
}

function StaffFormModal({
  staff,
  meta,
  isSuperAdmin,
  onClose
}: {
  staff: StaffMember | null;
  meta?: RolePermissionsData;
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const isEdit = Boolean(staff);
  const queryClient = useQueryClient();
  const [selectedOverrides, setSelectedOverrides] = useState<Permission[]>(staff?.permissionOverrides || []);
  const [showPermissions, setShowPermissions] = useState(false);

  const availableRoles: Role[] = meta?.roles || ['admin', 'sales', 'technician', 'accountant'];
  const allowedRoleOptions = availableRoles
    .filter((r) => isSuperAdmin || r !== 'super_admin')
    .map((r) => ({ label: r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: r }));

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: staff
      ? {
          name: staff.name,
          email: staff.email,
          phone: staff.phone || '',
          role: staff.role,
          isActive: staff.isActive
        }
      : {
          name: '',
          email: '',
          phone: '',
          role: 'sales',
          isActive: true
        }
  });

  const currentRole = watch('role');
  const roleBasePermissions = useMemo(() => {
    if (!meta || !currentRole) return [];
    return meta.rolePermissions[currentRole] || [];
  }, [meta, currentRole]);

  // Group permissions by module prefix (e.g. "products.read" -> module "products")
  const permissionGroups = useMemo(() => {
    if (!meta?.permissions) return {};
    const groups: Record<string, Permission[]> = {};
    for (const perm of meta.permissions) {
      const parts = perm.split('.');
      const groupName = parts[0] || 'general';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(perm);
    }
    return groups;
  }, [meta]);

  function togglePermission(perm: Permission) {
    if (selectedOverrides.includes(perm)) {
      setSelectedOverrides(selectedOverrides.filter((p) => p !== perm));
    } else {
      setSelectedOverrides([...selectedOverrides, perm]);
    }
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone?.trim() || undefined,
        role: values.role,
        isActive: values.isActive,
        permissionOverrides: selectedOverrides
      };

      if (values.password && values.password.trim()) {
        payload.password = values.password.trim();
      }

      if (isEdit && staff) {
        return api.put(`/staff/${staff._id}`, payload);
      }
      return api.post('/staff', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Staff member updated' : 'Staff account created successfully');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit Staff: ${staff?.name}` : 'Add Staff Account'} width="lg">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4 text-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full Name" required error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
          <Input label="Email Address" type="email" required error={errors.email?.message} {...register('email', { required: 'Email is required' })} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Phone Number" placeholder="+91 98765 43210" {...register('phone')} />
          <Select label="Role" options={allowedRoleOptions} {...register('role')} />
        </div>

        <div>
          <Input
            label={isEdit ? 'New Password (Optional)' : 'Password (Optional)'}
            type="password"
            hint={isEdit ? 'Leave blank to retain existing password' : 'Leave blank to automatically generate and email a secure temporary password'}
            {...register('password')}
          />
        </div>

        <div className="flex items-center gap-2 border-y border-line py-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" {...register('isActive')} className="h-4 w-4 rounded border-line text-brand focus:ring-brand" />
            <span className="text-xs font-medium text-ink">Account is Active</span>
          </label>
        </div>

        {/* Granular Permission Overrides Accordion */}
        <div className="rounded border border-line bg-paper/50">
          <button
            type="button"
            onClick={() => setShowPermissions(!showPermissions)}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-paper"
          >
            <div>
              <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-brand" />
                Granular Permissions & Overrides
              </p>
              <p className="text-[11px] text-slateink">
                {currentRole === 'super_admin'
                  ? 'Super Admins have bypass access to all operations'
                  : `${roleBasePermissions.length} permissions inherited by role, ${selectedOverrides.length} custom override(s)`}
              </p>
            </div>
            {showPermissions ? <ChevronDown className="h-4 w-4 text-slateink" /> : <ChevronRight className="h-4 w-4 text-slateink" />}
          </button>

          {showPermissions && (
            <div className="max-h-72 overflow-y-auto border-t border-line p-4 space-y-4 bg-white">
              {currentRole === 'super_admin' ? (
                <div className="flex items-center gap-2 text-xs text-amber bg-amber-light/30 p-3 rounded">
                  <Lock className="h-4 w-4" />
                  <span>The <b>Super Admin</b> role automatically includes all system permissions and cannot be restricted.</span>
                </div>
              ) : (
                Object.entries(permissionGroups).map(([group, perms]) => (
                  <div key={group} className="border-b border-line pb-3 last:border-b-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slateink">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const inRole = roleBasePermissions.includes(perm);
                        const isOverride = selectedOverrides.includes(perm);
                        const isActive = inRole || isOverride;

                        return (
                          <label
                            key={perm}
                            className={clsx(
                              'flex items-center justify-between rounded p-2 text-xs transition cursor-pointer select-none border',
                              isActive ? 'bg-brand-light/30 border-brand/20 text-ink' : 'bg-paper/30 border-line text-slateink hover:bg-paper'
                            )}
                          >
                            <span className="font-mono text-[11px]">{perm}</span>
                            <div className="flex items-center gap-1.5">
                              {inRole && (
                                <span className="text-[10px] text-brand bg-brand-light px-1.5 py-0.5 rounded">Role</span>
                              )}
                              <input
                                type="checkbox"
                                checked={isOverride}
                                onChange={() => togglePermission(perm)}
                                className="h-3.5 w-3.5 rounded border-line text-brand focus:ring-brand"
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Create Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
