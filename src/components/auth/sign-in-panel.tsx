import Image from 'next/image';
import { LoginForm } from '@/app/login/login-form';

export function SignInPanel({ next = '/dashboard', errorCode, modal = false }: { next?: string; errorCode?: string; modal?: boolean }) {
  const Heading = modal ? 'h2' : 'h1';
  return <div className="sign-in-panel">
    <div className="sign-in-art" aria-hidden="true">
      <Image src="/art/arena-signin.webp" alt="" fill priority sizes="(max-width: 640px) 100vw, 420px" className="object-cover" />
      <div className="sign-in-art-caption"><span className="founding-eyebrow">Project Arena</span><p>Your work.<br /><em>A new audience.</em></p></div>
    </div>
    <div className="sign-in-content"><p className="founding-eyebrow">For Builders</p>
      <Heading id={modal ? 'sign-in-title' : undefined} className="sign-in-title">Step inside.</Heading>
      <p className="sign-in-description">Sign in to manage your Projects, enter Arenas and follow your performance.</p>
      <LoginForm next={next} errorCode={errorCode} embedded />
    </div>
  </div>;
}
