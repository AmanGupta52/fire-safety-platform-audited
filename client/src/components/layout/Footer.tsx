import { Link } from 'react-router-dom';
import { FlameKindling, Phone, Mail, MapPin, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-20 bg-ink text-slate-400">
      <div className="container-page grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-safety"><FlameKindling className="h-4 w-4 text-white" /></div>
            <span className="heading text-sm text-paper">Fire Safety Platform</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">Fire extinguishers, alarm systems and safety equipment, with installation, refilling, inspection and AMC services across India.</p>
        </div>

        <FooterColumn title="Shop">
          <FooterLink to="/products">All products</FooterLink>
          <FooterLink to="/products?category=fire-extinguishers">Fire extinguishers</FooterLink>
          <FooterLink to="/products?category=fire-alarm-panels">Alarm panels</FooterLink>
          <FooterLink to="/products?category=smoke-detectors">Smoke detectors</FooterLink>
        </FooterColumn>

        <FooterColumn title="Services">
          <FooterLink to="/services/amc">AMC plans</FooterLink>
          <FooterLink to="/services/refilling">Refilling</FooterLink>
          <FooterLink to="/services/installation">Installation</FooterLink>
          <FooterLink to="/services/inspection">Inspection</FooterLink>
          <FooterLink to="/services/fire-safety-audit">Fire safety audit</FooterLink>
        </FooterColumn>

        <FooterColumn title="Company">
          <FooterLink to="/about">About us</FooterLink>
          <FooterLink to="/blog">Resources</FooterLink>
          <FooterLink to="/gallery">Project gallery</FooterLink>
          <FooterLink to="/faq">FAQs</FooterLink>
          <FooterLink to="/contact">Contact</FooterLink>
        </FooterColumn>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> +91-00000-00000</span>
            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> info@firesafety.example</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Navi Mumbai, Maharashtra, India</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy-policy" className="transition-colors hover:text-paper">Privacy policy</Link>
            <Link to="/terms" className="transition-colors hover:text-paper">Terms of service</Link>
            <span>© {new Date().getFullYear()} Fire Safety Platform</span>
          </div>
        </div>
      </div>

      <a
        href="https://wa.me/910000000000"
        target="_blank" rel="noreferrer"
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-forest text-white shadow-raised transition-colors hover:bg-forest/90"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="heading text-sm uppercase tracking-wide text-paper">{title}</p>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  );
}
function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="text-sm transition-colors hover:text-paper">{children}</Link>;
}
