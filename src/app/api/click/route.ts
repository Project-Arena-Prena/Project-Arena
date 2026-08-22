import { NextResponse } from 'next/server';

/** Outbound tracking moved to /go/[projectSlug], which records before redirecting. */
export async function POST() {
  return NextResponse.json({ error: 'use_go_route' }, { status: 410 });
}
