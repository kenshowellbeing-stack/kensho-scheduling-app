"use strict";exports.id=976,exports.ids=[976],exports.modules={16912:(e,t,n)=>{n.d(t,{X:()=>l,d:()=>d});var r=n(88565),o=n(9487),a=n(74847);function i(e){return{OR:[{status:"confirmed"},{status:"pending",holdExpiresAt:{gt:e}}]}}async function s(){let e=await o._.settings.findUnique({where:{id:1}})??{id:1,timezone:"Europe/London",bufferMinutes:15,minNoticeHours:12},t=await o._.availabilityRule.findMany(),n=new Map;for(let e of t)n.set(e.weekday,e);return{settings:e,rulesByWeekday:n}}async function l(e,t=21){let n=await o._.service.findUnique({where:{id:e}});if(!n||!n.active)throw Error("Service not found");let{settings:l,rulesByWeekday:d}=await s(),u=l.timezone,c=n.durationMinutes,m=l.bufferMinutes,f=new Date,g=f.getTime()+36e5*l.minNoticeHours,h=r.ou.now().setZone(u).startOf("day"),p=h.plus({days:t}).endOf("day"),[w,y,k]=await Promise.all([o._.booking.findMany({where:{AND:[i(f),{startsAt:{lt:p.toJSDate()}},{endsAt:{gt:h.toJSDate()}}]},select:{startsAt:!0,endsAt:!0}}),o._.blackoutDate.findMany({where:{startsAt:{lt:p.toJSDate()},endsAt:{gt:h.toJSDate()}},select:{startsAt:!0,endsAt:!0}}),(0,a.OX)(h.toJSDate(),p.toJSDate())]),b=w.map(e=>({start:e.startsAt.getTime()-6e4*m,end:e.endsAt.getTime()+6e4*m})),v=[...y.map(e=>({start:e.startsAt.getTime(),end:e.endsAt.getTime()})),...k],_=[];for(let e=0;e<=t;e++){let t=h.plus({days:e}),n=t.weekday%7,r=d.get(n);if(!r||!r.enabled)continue;let o=t.plus({minutes:r.startMinute}),a=t.plus({minutes:r.endMinute}),i=[],s=o,l=a.toMillis();for(;s.plus({minutes:c}).toMillis()<=l;){let e=s.toMillis(),t=s.plus({minutes:c}).toMillis(),n=e<g,r=b.some(n=>{var r;return r=n.start,e<n.end&&r<t}),o=v.some(n=>{var r;return r=n.start,e<n.end&&r<t});n||r||o||i.push({startISO:s.toUTC().toISO(),label:s.toFormat("HH:mm")}),s=s.plus({minutes:c})}i.length>0&&_.push({date:t.toFormat("yyyy-MM-dd"),weekdayLabel:t.toFormat("ccc"),dateLabel:t.toFormat("d LLL"),slots:i})}return{service:{id:n.id,name:n.name,durationMinutes:n.durationMinutes,priceCents:n.priceCents},days:_}}async function d(e,t){let n=await o._.service.findUnique({where:{id:e}});if(!n||!n.active)throw Error("Service not found");let{settings:l,rulesByWeekday:d}=await s(),u=l.timezone,c=n.durationMinutes,m=l.bufferMinutes,f=r.ou.fromISO(t,{zone:"utc"}).setZone(u);if(!f.isValid)throw Error("Invalid start time");let g=f.plus({minutes:c}),h=f.weekday%7,p=d.get(h);if(!p||!p.enabled)throw Error("Outside working days");let w=f.startOf("day"),y=w.plus({minutes:p.startMinute}),k=w.plus({minutes:p.endMinute});if(f.toMillis()<y.toMillis()||g.toMillis()>k.toMillis())throw Error("Outside working hours");let b=new Date,v=b.getTime()+36e5*l.minNoticeHours;if(f.toMillis()<v)throw Error("Too soon to book");let _=f.toMillis(),$=g.toMillis(),[E,A,T]=await Promise.all([o._.booking.findMany({where:{AND:[i(b),{startsAt:{lt:g.toJSDate()}},{endsAt:{gt:f.toJSDate()}}]},select:{startsAt:!0,endsAt:!0}}),o._.blackoutDate.findMany({where:{startsAt:{lt:g.toJSDate()},endsAt:{gt:f.toJSDate()}},select:{startsAt:!0,endsAt:!0}}),(0,a.OX)(f.toJSDate(),g.toJSDate())]),S=E.some(e=>{var t;return t=e.startsAt.getTime()-6e4*m,_<e.endsAt.getTime()+6e4*m&&t<$}),I=A.some(e=>{var t;return t=e.startsAt.getTime(),_<e.endsAt.getTime()&&t<$}),x=T.some(e=>{var t;return t=e.start,_<e.end&&t<$});if(S||I||x)throw Error("That slot is no longer available");return{startsAt:f.toUTC().toJSDate(),endsAt:g.toUTC().toJSDate()}}},24976:(e,t,n)=>{n.d(t,{Y:()=>l,er:()=>c,kb:()=>d,rx:()=>m,t7:()=>u});var r=n(9487),o=n(74847),a=n(36119),i=n(69206),s=n(16912);async function l(e,t){let n=await r._.booking.findUnique({where:{id:e},include:{service:!0}});if(!n)return{ok:!1,reason:"not_found"};if("confirmed"===n.status)return{ok:!0,alreadyConfirmed:!0,booking:{id:n.id}};if(await r._.booking.findFirst({where:{id:{not:n.id},status:"confirmed",startsAt:{lt:n.endsAt},endsAt:{gt:n.startsAt}},select:{id:!0}}))return await r._.booking.update({where:{id:n.id},data:{status:"conflict",stripePaymentId:t??null}}),{ok:!1,reason:"conflict"};await r._.booking.update({where:{id:n.id},data:{status:"confirmed",stripePaymentId:t??n.stripePaymentId,holdExpiresAt:null}});try{let e=await (0,o.JV)(n);e&&await r._.booking.update({where:{id:n.id},data:{googleEventId:e}})}catch(e){console.error(`Google Calendar sync failed for booking ${n.id}:`,e)}return await (0,a.jJ)(n),{ok:!0,alreadyConfirmed:!1,booking:{id:n.id}}}async function d(){let{count:e}=await r._.booking.updateMany({where:{status:"pending",holdExpiresAt:{lt:new Date}},data:{status:"expired"}});return e}async function u(e){let t=await r._.settings.findUnique({where:{id:1}}),n=t?.cancelCutoffHours??24;return Date.now()<=e.getTime()-36e5*n}async function c(e,t){let n=await r._.booking.findUnique({where:{id:e},include:{service:!0}});if(!n)return{ok:!1,reason:"not_found"};if("cancelled"===n.status)return{ok:!1,reason:"already_cancelled"};if(t.enforceWindow&&!await u(n.startsAt))return{ok:!1,reason:"too_late"};let s=!1;if(n.stripePaymentId)try{await i.A.refunds.create({payment_intent:n.stripePaymentId}),s=!0}catch(e){console.error(`Refund failed for booking ${n.id}:`,e)}if(await r._.booking.update({where:{id:n.id},data:{status:"cancelled"}}),n.googleEventId)try{await (0,o.d1)(n.googleEventId)}catch(e){console.error(`Calendar delete failed for booking ${n.id}:`,e)}return await (0,a.wS)(n,s),{ok:!0,refunded:s}}async function m(e,t,n){let i,l;let d=await r._.booking.findUnique({where:{id:e},include:{service:!0}});if(!d)return{ok:!1,reason:"not_found"};if("confirmed"!==d.status)return{ok:!1,reason:"not_confirmed"};if(n.enforceWindow&&!await u(d.startsAt))return{ok:!1,reason:"too_late"};let c=d.startsAt;try{({startsAt:i,endsAt:l}=await (0,s.d)(d.serviceId,t))}catch{return{ok:!1,reason:"slot_unavailable"}}if(await r._.booking.update({where:{id:d.id},data:{startsAt:i,endsAt:l}}),d.googleEventId)try{await (0,o.KI)(d.googleEventId,i,l)}catch(e){console.error(`Calendar update failed for booking ${d.id}:`,e)}return await (0,a.xO)({...d,startsAt:i},c),{ok:!0}}},9487:(e,t,n)=>{n.d(t,{_:()=>o});var r=n(53524);let o=globalThis.prisma??new r.PrismaClient},36119:(e,t,n)=>{n.d(t,{Jf:()=>f,jJ:()=>m,wS:()=>g,xO:()=>h});var r=n(82591),o=n(88565),a=n(9487),i=n(8267);function s(){let e=process.env.RESEND_API_KEY;return e?new r.R(e):null}function l(){return process.env.EMAIL_FROM||"Kenshō <onboarding@resend.dev>"}async function d(e){let t=await a._.settings.findUnique({where:{id:1}}),n=t?.timezone??"Europe/London";return o.ou.fromJSDate(e,{zone:"utc"}).setZone(n).toFormat("cccc d LLLL yyyy 'at' HH:mm")}function u(e){return`<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">${e}</div>`}function c(e){if(!e)return{html:"",text:""};let t=`http://localhost:3000/booking/manage/${e}`;return{html:`<p style="margin:16px 0"><a href="${t}" style="color:#111">Need to change or cancel? Manage your booking here.</a></p>`,text:`
Need to change or cancel? Manage your booking: ${t}
`}}async function m(e){let t=s();if(t)try{let n=await d(e.startsAt),r=0===e.service.priceCents?"Free":`Paid ${(0,i.T4)(e.service.priceCents)}`,o=c(e.manageToken);await t.emails.send({from:l(),to:e.customerEmail,subject:`Booking confirmed: ${e.service.name} — ${n}`,text:`Hi ${e.customerName},

Your booking is confirmed.

${e.service.name}
${n}
${r}
${o.text}
See you then!
Kenshō`,html:u(`<h2 style="margin:0 0 12px">You're booked! 🎉</h2>
         <p>Hi ${e.customerName},</p>
         <p>Your booking is confirmed:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${n}<br>${r}
         </p>
         ${o.html}
         <p>See you then!<br>Kenshō</p>`)})}catch(e){console.error("Failed to send confirmation email:",e)}}async function f(e){let t=s();if(t)try{let n=await d(e.startsAt),r=c(e.manageToken);await t.emails.send({from:l(),to:e.customerEmail,subject:`Reminder: ${e.service.name} tomorrow — ${n}`,text:`Hi ${e.customerName},

This is a friendly reminder of your upcoming booking:

${e.service.name}
${n}
${r.text}
See you then!
Kenshō`,html:u(`<h2 style="margin:0 0 12px">See you tomorrow 👋</h2>
         <p>Hi ${e.customerName},</p>
         <p>A friendly reminder of your upcoming booking:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${n}
         </p>
         ${r.html}
         <p>See you then!<br>Kenshō</p>`)})}catch(e){console.error("Failed to send reminder email:",e)}}async function g(e,t){let n=s();if(n)try{let r=await d(e.startsAt),o=t?"Your payment has been refunded in full — it may take a few days to show on your statement.":"";await n.emails.send({from:l(),to:e.customerEmail,subject:`Booking cancelled: ${e.service.name} — ${r}`,text:`Hi ${e.customerName},

Your booking has been cancelled:

${e.service.name}
${r}

${o}

Hope to see you another time.
Kenshō`,html:u(`<h2 style="margin:0 0 12px">Booking cancelled</h2>
         <p>Hi ${e.customerName},</p>
         <p>Your booking has been cancelled:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${r}
         </p>
         ${t?`<p>${o}</p>`:""}
         <p>Hope to see you another time.<br>Kenshō</p>`)})}catch(e){console.error("Failed to send cancellation email:",e)}}async function h(e,t){let n=s();if(n)try{let r=await d(e.startsAt),o=await d(t),a=c(e.manageToken);await n.emails.send({from:l(),to:e.customerEmail,subject:`Booking moved: ${e.service.name} — ${r}`,text:`Hi ${e.customerName},

Your booking has been rescheduled.

New time: ${r}
(was ${o})
${a.text}
See you then!
Kenshō`,html:u(`<h2 style="margin:0 0 12px">Your booking has moved</h2>
         <p>Hi ${e.customerName},</p>
         <p>Your booking has been rescheduled:</p>
         <p style="background:#f6f6f6;border-radius:8px;padding:16px;margin:16px 0">
           <strong>${e.service.name}</strong><br>${r}<br>
           <span style="color:#888;text-decoration:line-through">${o}</span>
         </p>
         ${a.html}
         <p>See you then!<br>Kenshō</p>`)})}catch(e){console.error("Failed to send reschedule email:",e)}}},8267:(e,t,n)=>{n.d(t,{LU:()=>a,T4:()=>o,wA:()=>r});let r="GBP";function o(e){return 0===e?"Free":new Intl.NumberFormat("en-GB",{style:"currency",currency:r}).format(e/100)}function a(e){let t=Math.floor(e/60),n=e%60,r=[];return t>0&&r.push(`${t} hr`),n>0&&r.push(`${n} min`),r.join(" ")||"0 min"}},74847:(e,t,n)=>{n.d(t,{JV:()=>l,KI:()=>d,OX:()=>c,_s:()=>s,cS:()=>i,d1:()=>u});var r=n(97816),o=n(9487);function a(){let e=process.env.GOOGLE_CLIENT_ID,t=process.env.GOOGLE_CLIENT_SECRET,n=process.env.GOOGLE_REDIRECT_URI;if(!e||!t||!n)throw Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI in .env");return new r.lkr.auth.OAuth2(e,t,n)}function i(){return a().generateAuthUrl({access_type:"offline",prompt:"consent",scope:["https://www.googleapis.com/auth/calendar"]})}async function s(e){let t=a(),{tokens:n}=await t.getToken(e);if(!n.refresh_token)throw Error("Google didn't return a refresh token. This usually means the account was already connected once before — go to https://myaccount.google.com/permissions, remove this app's access, and try connecting again.");await o._.settings.update({where:{id:1},data:{googleRefreshToken:n.refresh_token}})}async function l(e){let t=await o._.settings.findUnique({where:{id:1}});if(!t?.googleRefreshToken)return null;let n=a();n.setCredentials({refresh_token:t.googleRefreshToken});let i=r.lkr.calendar({version:"v3",auth:n});return(await i.events.insert({calendarId:t.googleCalendarId,requestBody:{summary:`${e.service.name} — ${e.customerName}`,description:`Booked via Kenshō booking site.
Customer: ${e.customerName}
Email: ${e.customerEmail}
Booking ID: ${e.id}`,start:{dateTime:e.startsAt.toISOString()},end:{dateTime:e.endsAt.toISOString()}}})).data.id??null}async function d(e,t,n){let i=await o._.settings.findUnique({where:{id:1}});if(!i?.googleRefreshToken)return;let s=a();s.setCredentials({refresh_token:i.googleRefreshToken});let l=r.lkr.calendar({version:"v3",auth:s});await l.events.patch({calendarId:i.googleCalendarId,eventId:e,requestBody:{start:{dateTime:t.toISOString()},end:{dateTime:n.toISOString()}}})}async function u(e){let t=await o._.settings.findUnique({where:{id:1}});if(!t?.googleRefreshToken)return;let n=a();n.setCredentials({refresh_token:t.googleRefreshToken});let i=r.lkr.calendar({version:"v3",auth:n});await i.events.delete({calendarId:t.googleCalendarId,eventId:e})}async function c(e,t){let n=await o._.settings.findUnique({where:{id:1}});if(!n?.googleRefreshToken)return[];try{let o=a();o.setCredentials({refresh_token:n.googleRefreshToken});let i=r.lkr.calendar({version:"v3",auth:o}),s=((await i.calendarList.list()).data.items??[]).map(e=>e.id).filter(e=>!!e);if(0===s.length)return[];let l=await i.freebusy.query({requestBody:{timeMin:e.toISOString(),timeMax:t.toISOString(),items:s.map(e=>({id:e}))}}),d=[];for(let e of Object.values(l.data.calendars??{}))for(let t of e.busy??[])t.start&&t.end&&d.push({start:new Date(t.start).getTime(),end:new Date(t.end).getTime()});return d}catch(e){return console.error("Failed to read Google Calendar busy times:",e),[]}}},69206:(e,t,n)=>{n.d(t,{A:()=>a,F:()=>i});var r=n(49404);let o=process.env.STRIPE_SECRET_KEY;o||console.warn("⚠️  STRIPE_SECRET_KEY is not set — payment routes will fail until it is.");let a=new r.ZP(o??"sk_missing",{typescript:!0}),i="http://localhost:3000"}};