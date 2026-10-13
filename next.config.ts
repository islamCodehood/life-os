import type { NextConfig } from 'next';
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseOrigin = '';
if(supabase){try{supabaseOrigin=new URL(supabase).origin}catch{ /* runtime env validation owns errors */ }}
const csp=[
 "default-src 'self'","base-uri 'self'","form-action 'self'","object-src 'none'",
 "frame-ancestors 'none'","img-src 'self' data: blob:",
 "font-src 'self' data:","manifest-src 'self'","worker-src 'self' blob:",
 // Next.js hydrated app currently uses inline bootstrap and styles; replace with nonce
 // middleware in a separate security release before requiring a strict CSP.
 "script-src 'self' 'unsafe-inline'","style-src 'self' 'unsafe-inline'",
 "connect-src 'self' "+(supabaseOrigin?supabaseOrigin:''),
].join('; ');
const headers=[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
 {key:'Content-Security-Policy',value:csp},
 {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
 ...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}]:[]),
];
const nextConfig: NextConfig = {
 poweredByHeader:false,
 reactStrictMode:true,
 async headers(){return [{source:'/:path*',headers}];},
};
export default nextConfig;
