"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FaTachometerAlt, FaUsers, FaSignOutAlt, FaCog, FaUserCircle, FaShoppingBag, FaClipboardList, FaGlobe, FaPlane, FaChalkboardTeacher, FaDumbbell } from "react-icons/fa";
import LogoutButton from "@/components/LogoutButton";
import { api } from "../../lib/admin/eventApi.js";

const labelize = (s = "") =>
  String(s)
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

export default function AdminLayout({ children }) {
  const [dateTime, setDateTime] = useState(new Date());
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const res = await api("/auth/me");
        let payload = res;
        if (res && typeof res.json === "function") payload = await res.json();
        const me = payload?.data ?? payload?.user ?? payload;
        if (!mounted) return;
        setRole(me?.role ?? null);
        setName(me?.fullName ?? "");
      } catch (err) {
        console.error("Failed to fetch current user:", err);
      }
    };
    fetchMe();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex h-screen w-screen">
      <aside className="w-[222px] bg-surface text-root-primary flex flex-col justify-between p-5">
        <div>
          <div className="flex items-center justify-center border-b border-root">
            <img src="/logo.png" alt="Company Logo" className="object-contain" />
          </div>

           {/* Menu */}
          <nav className="flex flex-col gap-4 p-4">
            <Link href="/admin/" className="menu-item">
               <FaTachometerAlt /> <span>Home</span>
             </Link>
 
             {role === "admin" && (
               <>
                 <Link href="/admin/users" className="menu-item">
                    <FaUsers /> <span>Users</span>
                  </Link>
                  <Link href="/admin/vendor-requests" className="menu-item">
                    <FaClipboardList /> <span>Applications</span>
                  </Link>
                </>
              )}
                
            <Link href="/admin/events" className="menu-item">
               <FaClipboardList /> <span>Events</span>
             </Link>
            
 
            {role === "event_office" && (
              <>
                <Link href="/admin/bazaars" className="menu-item">
                   <FaShoppingBag /> <span>Bazaars</span>
                 </Link>
                <Link href="/admin/conferences" className="menu-item">
                   <FaGlobe /> <span>Conferences</span>
                 </Link>
                <Link href="/admin/trips" className="menu-item">
                   <FaPlane /> <span>Trips</span>
                 </Link>
                <Link href="/admin/workshops" className="menu-item">
                   <FaChalkboardTeacher /> <span>Workshops</span>
                 </Link>
                <Link href="/admin/gym-sessions" className="menu-item">
                   <FaDumbbell /> <span>Gym</span>
                 </Link>
                 <Link href="/admin/vendor-requests" className="menu-item">
                   <FaClipboardList /> <span>Applications</span>
                 </Link>
               </>
             )}
 
            {role && role !== "admin" && role !== "event_office" && (
               <>
                <Link href="/admin/users" className="menu-item">
                   <FaUsers /> <span>Users</span>
                 </Link>
                <Link href="/admin/events" className="menu-item">
                   <FaClipboardList /> <span>Events</span>
                 </Link>
                <Link href="/admin/bazaars" className="menu-item">
                   <FaShoppingBag /> <span>Bazaars</span>
                 </Link>
                <Link href="/admin/conferences" className="menu-item">
                   <FaGlobe /> <span>Conferences</span>
                 </Link>
                <Link href="/admin/trips" className="menu-item">
                   <FaPlane /> <span>Trips</span>
                 </Link>
                <Link href="/admin/workshops" className="menu-item">
                   <FaChalkboardTeacher /> <span>Workshops</span>
                 </Link>
                <Link href="/admin/gym-sessions" className="menu-item">
                   <FaDumbbell /> <span>Gym</span>
                 </Link>
                 <Link href="/admin/vendor-requests" className="menu-item">
                   <FaClipboardList /> <span>Applications</span>
                 </Link>
               </>
             )}
           </nav>
         </div>
 
        <div className="p-4 border-t border-root">
          <LogoutButton className="w-full flex items-center justify-center gap-2 bg-error py-2 rounded hover:opacity-90 transition">
            <FaSignOutAlt /> Logout
          </LogoutButton>
        </div>
       </aside>
 
       <div className="flex-1 flex flex-col">
        <header className="h-16 bg-surface border-b border-root flex items-center justify-between px-6">
           {/* Profile */}
          <div className="flex items-center gap-3">
            <FaUserCircle className="text-3xl text-root-secondary" />
            <div className="flex flex-col leading-tight">
              <span className="font-medium text-root-primary">{name || "User"}</span>
              <span className="text-xs text-root-secondary">{labelize(role) || "Role"}</span>
            </div>
          </div>
 
           {/* Date / Time / Settings */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col text-right leading-tight">
              <span className="font-medium text-root-primary">{dateTime.toLocaleTimeString()}</span>
              <span className="text-xs text-root-secondary">{dateTime.toLocaleDateString()}</span>
            </div>
            <span className="text-root-secondary">|</span>
            <button className="text-root-secondary hover:text-primary">
              <FaCog />
            </button>
          </div>
         </header>
 
        <main className="flex-1 p-6 bg-root overflow-y-auto">
           {children}
         </main>
       </div>
     </div>
   );
 }
