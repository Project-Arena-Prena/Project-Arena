import { cache } from 'react';
import { connection } from 'next/server';
export const getServerNow = cache(async () => {
  await connection();
  return Date.now();
});
