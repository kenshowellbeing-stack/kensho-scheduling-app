"use strict";(()=>{var e={};e.id=50,e.ids=[50],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},29355:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>y,requestAsyncStorage:()=>d,routeModule:()=>p,serverHooks:()=>h,staticGenerationAsyncStorage:()=>f});var n={};r.r(n),r.d(n,{GET:()=>m,runtime:()=>l});var o=r(49303),a=r(88716),i=r(60670),s=r(87070),c=r(9487),u=r(36119);let l="nodejs";async function m(e){let t=process.env.CRON_SECRET;if(t){let r=e.headers.get("authorization"),n=new URL(e.url).searchParams.get("secret");if(r!==`Bearer ${t}`&&n!==t)return s.NextResponse.json({error:"Unauthorized"},{status:401})}let r=new Date,n=new Date(r.getTime()+864e5),o=await c._.booking.findMany({where:{status:"confirmed",reminderSentAt:null,startsAt:{gt:r,lte:n}},include:{service:!0}}),a=0;for(let e of o)await (0,u.Jf)(e),await c._.booking.update({where:{id:e.id},data:{reminderSentAt:new Date}}),a++;return s.NextResponse.json({ok:!0,sent:a})}let p=new o.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/cron/reminders/route",pathname:"/api/cron/reminders",filename:"route",bundlePath:"app/api/cron/reminders/route"},resolvedPagePath:"/Users/scottjeffrey/Downloads/booking-app/app/api/cron/reminders/route.ts",nextConfigOutput:"standalone",userland:n}),{requestAsyncStorage:d,staticGenerationAsyncStorage:f,serverHooks:h}=p,g="/api/cron/reminders/route";function y(){return(0,i.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:f})}},9487:(e,t,r)=>{r.d(t,{_:()=>o});var n=r(53524);let o=globalThis.prisma??new n.PrismaClient},36119:(e,t,r)=>{r.d(t,{Jf:()=>d,jJ:()=>p,wS:()=>f,xO:()=>h});var n=r(82591),o=r(88565),a=r(9487),i=r(8267);function s(){let e=process.env.RESEND_API_KEY;return e?new n.R(e):null}function c(){return process.env.EMAIL_FROM||"Kenshō <onboarding@resend.dev>"}async function u(e){let t=await a._.settings.findUnique({where:{id:1}}),r=t?.timezone??"Europe/London";return o.ou.fromJSDate(e,{zone:"utc"}).setZone(r).toFormat("cccc d LLLL yyyy 'at' HH:mm")}function l(e){return`<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">${e}</div>`}function m(e){if(!e)return{html:"",text:""};let t=`http://localhost:3000/booking/manage/${e}`;return{html:`<p style="margin:16px 0"><a href="${t}" style="color:#111">Need to change or cancel? Manage your booking here.</a></p>`,text:`
Need to change or cancel? Manage your booking: ${t}
`}}async function p(e){let t=s();if(t)try{let r=await u(e.startsAt),n=0===e.service.priceCents?"Free":`Paid ${(0,i.T4)(e.service.priceCents)}`,o=m(e.manageToken);await t.emails.send({from:c(),to:e.customerEmail,subject:`Booking confirmed: ${e.service.name} — ${r}`,text:`Hi ${e.customerName},

Your booking is confirmed.

${e.service.name}
${r}
${n}
${o.text}
See you then!
Kenshō`,html:l(`<h2 style="margin:0 0 12px">You're booked! 🎉</h2>
         <p>Hi ${e.customerName},</p>
         <p>Your booking is confirmed:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${r}<br>${n}
         </p>
         ${o.html}
         <p>See you then!<br>Kenshō</p>`)})}catch(e){console.error("Failed to send confirmation email:",e)}}async function d(e){let t=s();if(t)try{let r=await u(e.startsAt),n=m(e.manageToken);await t.emails.send({from:c(),to:e.customerEmail,subject:`Reminder: ${e.service.name} tomorrow — ${r}`,text:`Hi ${e.customerName},

This is a friendly reminder of your upcoming booking:

${e.service.name}
${r}
${n.text}
See you then!
Kenshō`,html:l(`<h2 style="margin:0 0 12px">See you tomorrow 👋</h2>
         <p>Hi ${e.customerName},</p>
         <p>A friendly reminder of your upcoming booking:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${r}
         </p>
         ${n.html}
         <p>See you then!<br>Kenshō</p>`)})}catch(e){console.error("Failed to send reminder email:",e)}}async function f(e,t){let r=s();if(r)try{let n=await u(e.startsAt),o=t?"Your payment has been refunded in full — it may take a few days to show on your statement.":"";await r.emails.send({from:c(),to:e.customerEmail,subject:`Booking cancelled: ${e.service.name} — ${n}`,text:`Hi ${e.customerName},

Your booking has been cancelled:

${e.service.name}
${n}

${o}

Hope to see you another time.
Kenshō`,html:l(`<h2 style="margin:0 0 12px">Booking cancelled</h2>
         <p>Hi ${e.customerName},</p>
         <p>Your booking has been cancelled:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${n}
         </p>
         ${t?`<p>${o}</p>`:""}
         <p>Hope to see you another time.<br>Kenshō</p>`)})}catch(e){console.error("Failed to send cancellation email:",e)}}async function h(e,t){let r=s();if(r)try{let n=await u(e.startsAt),o=await u(t),a=m(e.manageToken);await r.emails.send({from:c(),to:e.customerEmail,subject:`Booking moved: ${e.service.name} — ${n}`,text:`Hi ${e.customerName},

Your booking has been rescheduled.

New time: ${n}
(was ${o})
${a.text}
See you then!
Kenshō`,html:l(`<h2 style="margin:0 0 12px">Your booking has moved</h2>
         <p>Hi ${e.customerName},</p>
         <p>Your booking has been rescheduled:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${n}<br>
           <span style="color:#888;text-decoration:line-through">${o}</span>
         </p>
         ${a.html}
         <p>See you then!<br>Kenshō</p>`)})}catch(e){console.error("Failed to send reschedule email:",e)}}},8267:(e,t,r)=>{r.d(t,{LU:()=>a,T4:()=>o,wA:()=>n});let n="GBP";function o(e){return 0===e?"Free":new Intl.NumberFormat("en-GB",{style:"currency",currency:n}).format(e/100)}function a(e){let t=Math.floor(e/60),r=e%60,n=[];return t>0&&n.push(`${t} hr`),r>0&&n.push(`${r} min`),n.join(" ")||"0 min"}},38238:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"ReflectAdapter",{enumerable:!0,get:function(){return r}});class r{static get(e,t,r){let n=Reflect.get(e,t,r);return"function"==typeof n?n.bind(e):n}static set(e,t,r,n){return Reflect.set(e,t,r,n)}static has(e,t){return Reflect.has(e,t)}static deleteProperty(e,t){return Reflect.deleteProperty(e,t)}}},95014:(e,t)=>{function r(e,t){let r;let n=e.split("/");return(t||[]).some(t=>!!n[1]&&n[1].toLowerCase()===t.toLowerCase()&&(r=t,n.splice(1,1),e=n.join("/")||"/",!0)),{pathname:e,detectedLocale:r}}Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"normalizeLocalePath",{enumerable:!0,get:function(){return r}})},37847:(e,t)=>{function r(e){return e.replace(/\/$/,"")||"/"}Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"removeTrailingSlash",{enumerable:!0,get:function(){return r}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[948,565,591,972],()=>r(29355));module.exports=n})();