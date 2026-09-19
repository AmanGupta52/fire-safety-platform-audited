import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { OtpInput } from '../../components/ui/OtpInput';
import { Button } from '../../components/ui/Button';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const email = (location.state as { email?: string })?.email || '';
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!email) navigate('/register', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/verify-otp', { email, otp })).data.data,
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.refreshToken);
      toast.success('Email verified — welcome!');
      navigate('/account');
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err));
      setOtp('');
    }
  });

  const resendMutation = useMutation({
    mutationFn: async () => (await api.post('/auth/resend-otp', { email })).data.data,
    onSuccess: () => { toast.success('A new code has been sent'); setCooldown(RESEND_COOLDOWN_SECONDS); setOtp(''); },
    onError: (err) => toast.error(apiErrorMessage(err))
  });

  if (!email) return null;

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <MailCheck className="h-6 w-6 text-brand" />
        </div>
        <h1 className="heading mt-4 text-xl text-ink">Verify your email</h1>
        <p className="mt-1 text-sm text-slateink">
          We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>. It expires in 10 minutes.
        </p>

        <form
          className="mt-6 flex flex-col items-center gap-5"
          onSubmit={(e) => { e.preventDefault(); if (otp.length === 6) verifyMutation.mutate(); }}
        >
          <OtpInput value={otp} onChange={setOtp} autoFocus disabled={verifyMutation.isPending} />
          <Button type="submit" fullWidth loading={verifyMutation.isPending} disabled={otp.length !== 6}>
            <ShieldCheck className="h-4 w-4" /> Verify &amp; continue
          </Button>
        </form>

        <p className="mt-5 text-sm text-slateink">
          Didn't get the code?{' '}
          {cooldown > 0 ? (
            <span className="text-slateink">Resend in {cooldown}s</span>
          ) : (
            <button
              onClick={() => resendMutation.mutate()}
              disabled={resendMutation.isPending}
              className="font-medium text-brand hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          )}
        </p>

        <p className="mt-6 text-xs text-slateink">
          Wrong email? <Link to="/register" className="font-medium text-brand hover:underline">Start over</Link>
        </p>
      </div>
    </div>
  );
}
