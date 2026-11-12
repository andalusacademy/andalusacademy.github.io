import { createClient } from "npm:@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13.1.2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RP_ID = "andalusacademy.github.io";
const RP_NAME = "أكاديمية الأندلس";
const ORIGIN = "https://andalusacademy.github.io";
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

function cors(origin: string | null) {
  const allowed = origin === ORIGIN || origin === "http://localhost:8000";
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : ORIGIN,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}
function reply(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}
function b64url(bytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(value: string): Uint8Array {
  const raw = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(raw + "=".repeat((4 - raw.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function cairoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
async function requireUser(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("يجب تسجيل الدخول من النظام أولًا.");
  const caller = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await caller.auth.getUser(token);
  if (error || !data.user) throw new Error("جلسة الدخول غير صالحة. سجل الدخول مرة أخرى.");
  const { data: profile, error: pe } = await admin.from("user_profiles")
    .select("id,username,full_name,role,branch,is_active")
    .eq("id", data.user.id).maybeSingle();
  if (pe || !profile || !profile.is_active || !["admin", "employee"].includes(profile.role)) {
    throw new Error("الحساب غير نشط أو غير مصرح له ببصمة الموظفين.");
  }
  return { user: data.user, profile };
}
async function saveChallenge(employeeId: string, action: "registration" | "authentication", challenge: string) {
  await admin.from("staff_attendance_challenges").delete().eq("employee_id", employeeId).eq("action", action);
  const { error } = await admin.from("staff_attendance_challenges").insert({
    employee_id: employeeId, action, challenge,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) throw error;
}
async function readChallenge(employeeId: string, action: "registration" | "authentication") {
  const { data, error } = await admin.from("staff_attendance_challenges")
    .select("id,challenge,expires_at").eq("employee_id", employeeId).eq("action", action)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}
async function getCredential(employeeId: string, credentialId: string) {
  const { data, error } = await admin.from("staff_attendance_credentials").select("*")
    .eq("employee_id", employeeId).eq("credential_id", credentialId).maybeSingle();
  if (error) throw error;
  return data;
}
async function verifyAssertion(employeeId: string, response: any) {
  const challenge = await readChallenge(employeeId, "authentication");
  if (!challenge) throw new Error("انتهت صلاحية طلب البصمة. حاول مرة أخرى.");
  const credential = await getCredential(employeeId, String(response?.id || ""));
  if (!credential) throw new Error("البصمة غير مسجلة لهذا الحساب.");
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
    credential: {
      id: credential.credential_id,
      publicKey: fromB64url(credential.public_key_b64),
      counter: Number(credential.sign_count || 0),
      transports: credential.transports || [],
    },
  });
  if (!verification.verified) throw new Error("فشل التحقق من البصمة.");
  await admin.from("staff_attendance_credentials").update({
    sign_count: verification.authenticationInfo.newCounter,
    last_used_at: new Date().toISOString(),
  }).eq("id", credential.id);
  await admin.from("staff_attendance_challenges").delete().eq("id", challenge.id);
  return credential;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ ok: false, message: "Method not allowed" }, 405, origin);
  try {
    const { profile } = await requireUser(req);
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "status") {
      const { data, error } = await admin.from("staff_attendance_credentials")
        .select("id,credential_id,last_used_at").eq("employee_id", profile.id);
      if (error) throw error;
      return reply({ ok: true, hasCredential: (data || []).length > 0, credentialCount: (data || []).length }, 200, origin);
    }

    if (action === "admin-list-credentials") {
      if (profile.role !== "admin") throw new Error("هذه العملية متاحة للإدارة فقط.");
      const { data: employees, error: employeeError } = await admin.from("user_profiles")
        .select("id,username,full_name,branch,is_active").eq("role", "employee").order("full_name");
      if (employeeError) throw employeeError;
      const employeeIds = (employees || []).map((x: any) => x.id);
      let credentials: any[] = [];
      let sessions: any[] = [];
      if (employeeIds.length) {
        const [{ data: credentialRows, error: credentialError }, { data: sessionRows, error: sessionError }] = await Promise.all([
          admin.from("staff_attendance_credentials")
            .select("id,employee_id,device_type,backed_up,transports,created_at,last_used_at")
            .in("employee_id", employeeIds).order("created_at", { ascending: false }),
          admin.from("staff_attendance_sessions")
            .select("employee_id,work_date,check_in_at,check_out_at")
            .in("employee_id", employeeIds).order("work_date", { ascending: false }),
        ]);
        if (credentialError) throw credentialError;
        if (sessionError) throw sessionError;
        credentials = credentialRows || [];
        sessions = sessionRows || [];
      }
      const latestByEmployee = new Map<string, any>();
      for (const row of sessions) if (!latestByEmployee.has(row.employee_id)) latestByEmployee.set(row.employee_id, row);
      const credentialsByEmployee = new Map<string, any[]>();
      for (const row of credentials) {
        const list = credentialsByEmployee.get(row.employee_id) || [];
        list.push({
          id: row.id, deviceType: row.device_type, backedUp: row.backed_up,
          transports: row.transports || [], createdAt: row.created_at, lastUsedAt: row.last_used_at,
        });
        credentialsByEmployee.set(row.employee_id, list);
      }
      return reply({
        ok: true,
        employees: (employees || []).map((employee: any) => ({
          id: employee.id, username: employee.username, fullName: employee.full_name,
          branch: employee.branch, isActive: employee.is_active,
          credentials: credentialsByEmployee.get(employee.id) || [],
          lastAttendance: latestByEmployee.get(employee.id) || null,
        })),
      }, 200, origin);
    }

    if (action === "admin-revoke-credential") {
      if (profile.role !== "admin") throw new Error("هذه العملية متاحة للإدارة فقط.");
      const credentialRowId = String(body?.credentialRowId || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(credentialRowId)) {
        throw new Error("معرّف البصمة غير صالح.");
      }
      const { data: target, error: targetError } = await admin.from("staff_attendance_credentials")
        .select("id,employee_id").eq("id", credentialRowId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) throw new Error("البصمة غير موجودة أو تم إلغاؤها بالفعل.");
      const { error: deleteError } = await admin.from("staff_attendance_credentials")
        .delete().eq("id", credentialRowId).eq("employee_id", target.employee_id);
      if (deleteError) throw deleteError;
      return reply({ ok: true, revoked: true }, 200, origin);
    }

    if (action === "register-options") {
      const { data: existing, error } = await admin.from("staff_attendance_credentials")
        .select("credential_id,transports").eq("employee_id", profile.id);
      if (error) throw error;
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: String(profile.username || profile.id),
        userDisplayName: String(profile.full_name || profile.username || "موظف الأندلس"),
        userID: new TextEncoder().encode(profile.id),
        attestationType: "none",
        excludeCredentials: (existing || []).map((x: any) => ({
          id: x.credential_id, transports: x.transports || [],
        })),
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        supportedAlgorithmIDs: [-7, -257],
      });
      await saveChallenge(profile.id, "registration", options.challenge);
      return reply({ ok: true, options }, 200, origin);
    }

    if (action === "register-verify") {
      const challenge = await readChallenge(profile.id, "registration");
      if (!challenge) throw new Error("انتهت صلاحية التسجيل. ابدأ تسجيل البصمة من جديد.");
      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) throw new Error("تعذر اعتماد البصمة.");
      const c = verification.registrationInfo.credential;
      const { data: owner, error: oe } = await admin.from("staff_attendance_credentials")
        .select("employee_id").eq("credential_id", c.id).maybeSingle();
      if (oe) throw oe;
      if (owner) throw new Error("هذا الجهاز مسجل بالفعل على حساب آخر.");
      const { error } = await admin.from("staff_attendance_credentials").insert({
        employee_id: profile.id,
        credential_id: c.id,
        public_key_b64: b64url(c.publicKey),
        sign_count: c.counter,
        transports: c.transports || [],
        device_type: verification.registrationInfo.credentialDeviceType,
        backed_up: verification.registrationInfo.credentialBackedUp,
      });
      if (error) throw error;
      await admin.from("staff_attendance_challenges").delete().eq("id", challenge.id);
      return reply({ ok: true, registered: true }, 200, origin);
    }

    if (action === "auth-options") {
      const { data: credentials, error } = await admin.from("staff_attendance_credentials")
        .select("credential_id,transports").eq("employee_id", profile.id);
      if (error) throw error;
      if (!credentials?.length) throw new Error("سجل بصمة هذا الجهاز أولًا.");
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: credentials.map((x: any) => ({ id: x.credential_id, transports: x.transports || [] })),
        userVerification: "required",
      });
      await saveChallenge(profile.id, "authentication", options.challenge);
      return reply({ ok: true, options }, 200, origin);
    }

    if (action === "punch") {
      const credential = await verifyAssertion(profile.id, body.response);
      const loc = body.location || {};
      const lat = Number(loc.latitude), lng = Number(loc.longitude), accuracy = Number(loc.accuracy);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180 || accuracy <= 0) {
        throw new Error("بيانات الموقع غير مكتملة. فعّل GPS وحاول مرة أخرى.");
      }
      const branch = profile.branch && profile.branch !== "الكل" ? profile.branch : "كفر الدوار";
      if (branch !== "كفر الدوار") throw new Error("هذا النظام مفعّل حاليًا لفرع كفر الدوار فقط.");
      const { data: cfg, error: ce } = await admin.from("staff_attendance_settings")
        .select("*").eq("branch", branch).eq("is_active", true).single();
      if (ce || !cfg) throw new Error("إعدادات موقع الفرع غير متاحة.");
      if (accuracy > cfg.max_accuracy_m) {
        throw new Error(`دقة GPS الحالية ${Math.round(accuracy)}م؛ المطلوب ${cfg.max_accuracy_m}م أو أفضل. حاول من مكان مفتوح.`);
      }
      const distance = distanceMeters(lat, lng, cfg.latitude, cfg.longitude);
      if (distance > cfg.radius_m) {
        throw new Error(`أنت خارج نطاق الحضور المسموح. المسافة التقريبية ${Math.round(distance)}م، والنطاق ${cfg.radius_m}م.`);
      }
      const workDate = cairoDate();
      const { data: existing, error: se } = await admin.from("staff_attendance_sessions")
        .select("*").eq("employee_id", profile.id).eq("work_date", workDate).maybeSingle();
      if (se) throw se;
      let eventType: "check_in" | "check_out";
      let saved: any;
      const now = new Date().toISOString();
      if (!existing) {
        eventType = "check_in";
        const { data, error } = await admin.from("staff_attendance_sessions").insert({
          employee_id: profile.id, branch, work_date: workDate,
          check_in_at: now, check_in_lat: lat, check_in_lng: lng,
          check_in_accuracy_m: accuracy, check_in_distance_m: Math.round(distance * 10) / 10,
          check_in_credential_id: credential.credential_id, status: "present",
        }).select("*").single();
        if (error) {
          if (error.code === "23505") throw new Error("تم تسجيل الحضور اليوم بالفعل.");
          throw error;
        }
        saved = data;
      } else if (!existing.check_out_at) {
        eventType = "check_out";
        const { data, error } = await admin.from("staff_attendance_sessions").update({
          check_out_at: now, check_out_lat: lat, check_out_lng: lng,
          check_out_accuracy_m: accuracy, check_out_distance_m: Math.round(distance * 10) / 10,
          check_out_credential_id: credential.credential_id, status: "completed", updated_at: now,
        }).eq("id", existing.id).is("check_out_at", null).select("*").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("تم تسجيل الانصراف بالفعل أو توجد حركة متزامنة.");
        saved = data;
      } else {
        throw new Error("تم تسجيل الحضور والانصراف لهذا اليوم بالفعل.");
      }
      const { error: logError } = await admin.from("staff_attendance_events").insert({
        session_id: saved.id, employee_id: profile.id, branch, event_type: eventType,
        occurred_at: now, latitude: lat, longitude: lng, accuracy_m: accuracy,
        distance_m: Math.round(distance * 10) / 10,
        credential_id: credential.credential_id, outcome: "accepted",
      });
      if (logError) throw logError;
      return reply({ ok: true, eventType, workDate, distanceMeters: Math.round(distance), recordedAt: now }, 200, origin);
    }

    return reply({ ok: false, message: "طلب غير معروف." }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    console.error("staff-attendance:", message);
    return reply({ ok: false, message }, 400, origin);
  }
});
