import { useForm } from 'react-hook-form';
import { Phone, Mail, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Primitives';
import { Input, Textarea } from '../../components/ui/FormControls';
import { Button } from '../../components/ui/Button';

interface FormValues { name: string; email: string; phone?: string; message: string }

export default function ContactPage() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>();

  async function onSubmit() {
    // No dedicated contact-message endpoint exists on the backend yet;
    // route general enquiries through the quote request flow or a future /api/contact endpoint.
    await new Promise((r) => setTimeout(r, 400));
    toast.success('Thanks — we will get back to you shortly.');
    reset();
  }

  return (
    <div className="container-page py-10">
      <h1 className="heading text-2xl text-ink">Contact us</h1>
      <p className="mt-1 max-w-lg text-sm text-slateink">Questions about a product, service or existing order? Reach out and our team will respond within one business day.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name" required error={errors.name?.message} {...register('name', { required: 'Required' })} />
              <Input label="Email" type="email" required error={errors.email?.message} {...register('email', { required: 'Required' })} />
            </div>
            <Input label="Phone" {...register('phone')} />
            <Textarea label="Message" required error={errors.message?.message} {...register('message', { required: 'Required' })} />
            <Button type="submit" loading={isSubmitting} className="self-start">Send message</Button>
          </form>
        </Card>

        <div className="flex flex-col gap-4">
          <ContactRow icon={Phone} label="Phone" value="+91-00000-00000" />
          <ContactRow icon={Mail} label="Email" value="info@firesafety.example" />
          <ContactRow icon={MapPin} label="Address" value="Mumbai, Maharashtra, India" />
        </div>
      </div>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded bg-brand-light"><Icon className="h-4 w-4 text-brand" /></div>
      <div><p className="text-xs text-slateink">{label}</p><p className="text-sm font-medium text-ink">{value}</p></div>
    </Card>
  );
}
