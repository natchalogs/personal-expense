import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion"; 
import './index.css';

// IMPORT LOGIC (คงเดิม 100%)
import { 
    GROUPS, USERS, MONTHS, YEARS, ALLOWED_EMAILS,
    formatTHB, getCurrentRealMonth, getNextMonthName, parseMonth, isMonthAfter,
    getSortedTransactions, getSortedAvailableMonths, calculateSummary, getFutureMonths, getNextInstallmentNote
} from './utils/calculations';

// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONSTANTS ---
const INITIAL_FORM = { group: 'Own By หมี', item: '', amount: '', splitType: 'เดี่ยว', owner: 'แมว', note: '', isRecurring: false, paymentMethod: '' };
const DATA_COLLECTION_ID = 'personal-expenses-tracker'; 

// --- ICONS ---
const Icon = memo(({ path, size = 18, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>
));

const icons = {
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    creditCard: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    pin: <><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check: <polyline points="20 6 9 17 4 12" />,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    chevronUp: <polyline points="18 15 12 9 6 15" />,
    wallet: <><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6.618a.5.5 0 0 0-.276-.447l-13-6.5A.5.5 0 0 0 8.224 3H6" /></>,
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
};

// --- COMPONENTS ---

const TransactionItem = memo(({ t, onTogglePin, onEdit, onDelete }) => {
    // 4. ใส่สีชนิดบัตร (Logic)
    let cardBadgeClass = "border-slate-200 text-slate-500 bg-white";
    if (t.paymentMethod === 'CardX') cardBadgeClass = "border-purple-200 text-purple-700 bg-purple-50";
    if (t.paymentMethod === 'Speedy') cardBadgeClass = "border-orange-200 text-orange-700 bg-orange-50";

    // 2. Logic เปลี่ยน Emoji ตามหมวด (Update)
    let groupIcon = '🛒';
    let groupIconBg = 'bg-slate-100 text-slate-500';
    
    if (t.group === 'Own By หมี') {
        groupIcon = '🐻';
        groupIconBg = 'bg-indigo-100 text-indigo-600';
    } else if (t.group === 'Own By แมว') {
        groupIcon = '🐱';
        groupIconBg = 'bg-pink-100 text-pink-600';
    } else if (t.group.includes('Pay')) {
        groupIcon = '🛍️'; // เปลี่ยนจาก 💳 เป็น 🛍️
        groupIconBg = 'bg-orange-50 text-orange-600';
    }

    // 3. & 4. Logic สีป้ายเจ้าของ/หาร2 (Update)
    let splitBadgeClass = "bg-slate-100 text-slate-600";
    if (t.splitType === 'หาร2') {
        splitBadgeClass = "bg-teal-100 text-teal-700"; // เปลี่ยนสีหาร 2 เป็นเขียว Teal (ไม่ซ้ำ CardX)
    } else if (t.owner === 'หมี') {
        splitBadgeClass = "bg-indigo-100 text-indigo-700"; // หมีสีน้ำเงิน
    } else if (t.owner === 'แมว') {
        splitBadgeClass = "bg-pink-100 text-pink-700"; // แมวสีชมพู
    }

    return (
        <motion.div 
            layout="position"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.005, backgroundColor: "rgba(248,250,252, 0.8)" }}
            whileTap={{ scale: 0.98 }}
            className={`group flex items-center justify-between p-3.5 bg-white/80 border-b border-slate-100 last:border-0 cursor-pointer transition-colors backdrop-blur-sm ${t.isPinned ? 'bg-indigo-50/60' : ''}`}
            onClick={() => onEdit(t)}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm flex-shrink-0 ${groupIconBg}`}>
                    {groupIcon}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-[15px] truncate">{t.item}</span>
                        {t.isPinned && <Icon path={icons.pin} size={12} className="text-indigo-500 rotate-45 flex-shrink-0"/>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`px-1.5 rounded-md font-medium ${splitBadgeClass}`}>
                            {t.splitType==='หาร2' ? 'หาร2' : t.owner}
                        </span>
                        
                        {/* 4. แสดงผลสีบัตร */}
                        {t.paymentMethod && <span className={`text-[10px] border px-1.5 rounded font-bold ${cardBadgeClass}`}>{t.paymentMethod}</span>}
                        
                        {t.note && <span className="truncate max-w-[100px] text-slate-400">• {t.note}</span>}
                    </div>
                </div>
            </div>

            <div className="text-right pl-3">
                <div className="font-bold text-slate-900">{formatTHB(t.amount)}</div>
                <div className="flex justify-end gap-2 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-device-actions">
    <button onClick={(e)=>{e.stopPropagation();onTogglePin(t)}} className={`p-1 rounded-full hover:bg-slate-100 ${t.isPinned?'text-indigo-500':'text-slate-300'}`}>
        <Icon path={icons.pin} size={16}/> {/* ปรับขนาดใหญ่ขึ้นนิดนึงให้จิ้มง่าย (14 -> 16) */}
    </button>
    <button onClick={(e)=>{e.stopPropagation();onDelete(t.id)}} className="p-1 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500">
        <Icon path={icons.trash} size={16}/> {/* ปรับขนาดใหญ่ขึ้นนิดนึงให้จิ้มง่าย (14 -> 16) */}
    </button>
</div>
            </div>
        </motion.div>
    );
});

const BentoCard = ({ title, value, subValue, icon, color = "bg-white", textColor = "text-slate-800", className="", onClick }) => (
    <motion.div 
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`${color} rounded-[24px] p-5 shadow-sm border border-slate-100/50 flex flex-col justify-between relative overflow-hidden group cursor-pointer ${className}`}
    >
        <div className="flex justify-between items-start z-10">
            <span className={`text-xs font-bold uppercase tracking-wider opacity-70 ${textColor}`}>{title}</span>
            {icon && <div className={`p-2 rounded-full bg-white/20 backdrop-blur-md ${textColor}`}>{icon}</div>}
        </div>
        <div className="z-10 mt-2">
            <h3 className={`text-2xl font-bold tracking-tight ${textColor}`}>{value}</h3>
            {subValue && <p className={`text-xs font-medium mt-1 opacity-80 ${textColor}`}>{subValue}</p>}
        </div>
        {/* Background Decorative Blur */}
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
    </motion.div>
);

function App() {
    // --- STATE & LOGIC ---
    const [user, setUser] = useState(null);
    const [rawTransactions, setRawTransactions] = useState([]);
    const [settings, setSettings] = useState({ salary: 0, savings: 0 });
    const [currentMonth, setCurrentMonth] = useState(() => localStorage.getItem('current_month_fb') || getCurrentRealMonth());
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI State
    const [isModalOpen, setModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isMonthOpen, setMonthOpen] = useState(false);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [form, setForm] = useState(INITIAL_FORM);
    
    // UI State - Collapsible Sections
    const [isStatsOpen, setStatsOpen] = useState(false); 
    const [isCardsOpen, setCardsOpen] = useState(false); // 2. State สำหรับพับบัตร
    
    const [isBudgetModalOpen, setBudgetModalOpen] = useState(false);
    const [tempBudget, setTempBudget] = useState({ salary: 0, savings: 0 });

    useEffect(() => {
        if (isModalOpen || isBudgetModalOpen) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
        return () => document.body.style.overflow = '';
    }, [isModalOpen, isBudgetModalOpen]);

    useEffect(() => {
        setPersistence(auth, browserLocalPersistence);
        getRedirectResult(auth).catch(() => {});
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u && ALLOWED_EMAILS.includes(u.email)) setUser(u);
            else if (u) { alert("คุณไม่มีสิทธิ์เข้าใช้งาน"); signOut(auth); setUser(null); }
            else setUser(null);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        const unsubTx = onSnapshot(collection(db, 'artifacts', DATA_COLLECTION_ID, 'transactions'), (snap) => setRawTransactions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubSet = onSnapshot(doc(db, 'settings', 'monthly'), (doc) => { if(doc.exists()) setSettings(doc.data()[currentMonth] || {salary:0, savings:0}); });
        return () => { unsubTx(); unsubSet(); };
    }, [user, currentMonth]);

    useEffect(() => { localStorage.setItem('current_month_fb', currentMonth); }, [currentMonth]);

    const transactions = useMemo(() => getSortedTransactions(rawTransactions, currentMonth), [rawTransactions, currentMonth]);
    const availableMonths = useMemo(() => getSortedAvailableMonths(rawTransactions, currentMonth), [rawTransactions, currentMonth]);
    const summary = useMemo(() => calculateSummary(transactions, settings), [transactions, settings]);

    // --- HANDLERS ---
    const handleLogin = async () => { const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); } catch(e) { try { await signInWithRedirect(auth, provider); } catch (e2) { alert("Login Failed"); } } };
    const handleLogout = () => signOut(auth);

    const handleStartNewMonth = async () => {
        // 1. กัน User กดปุ่มรัวๆ (Safety First!)
        if (isSubmitting) return;

        const nextM = getNextMonthName(currentMonth);
        
        // ดึงข้อมูลของเดือนหน้ามารรอเช็ค
        const nextMonthTransactions = rawTransactions.filter(t => t.monthKey === nextM);
        const isNextMonthExist = availableMonths.includes(nextM);

        // ถามยืนยัน
        const confirmMsg = isNextMonthExist 
            ? `เดือน ${nextM} มีอยู่แล้ว ต้องการเช็ครายการตกหล่น (Recurring/ผ่อน) หรือไม่?`
            : `ยืนยันขึ้นเดือนใหม่ ${nextM}?`;

        if (!confirm(confirmMsg)) return;

        // เริ่มกระบวนการล็อกปุ่ม
        setIsSubmitting(true);

        try {
            // ถ้าเดือนมีอยู่แล้ว เปลี่ยนหน้าไปรอได้เลย (UX จะได้ไม่ค้าง)
            if (isNextMonthExist) {
                setCurrentMonth(nextM);
                setMonthOpen(false);
            }

            const batch = writeBatch(db);
            let addedCount = 0;

            transactions.forEach(t => {
                let nextNote = t.note || '';
                let keep = false;
                
                // คำนวณงวด (ใช้ Logic จาก calculations.js ที่ Import มา)
                const { note, hasNext } = getNextInstallmentNote(nextNote);
                
                if(hasNext) { 
                    nextNote = note; 
                    keep = true; 
                } else if(t.isRecurring) {
                    keep = true;
                }

                if(keep) { 
                    // --- หัวใจสำคัญ: เช็คกันซ้ำ (Check Duplicate) ---
                    // เช็คว่าในเดือนหน้า มีรายการที่ "ชื่อเหมือน" และ "Note เหมือน" หรือยัง?
                    const isDuplicate = nextMonthTransactions.some(existing => 
                        existing.item === t.item && 
                        (existing.note || '') === nextNote 
                    );

                    if (!isDuplicate) {
                        const n = {
                            ...t, 
                            note: nextNote, 
                            monthKey: nextM, 
                            createdAt: new Date().toISOString(), 
                            isPinned: t.isPinned || false
                        }; 
                        delete n.id; // ลบ ID เดิมทิ้ง เพื่อให้สร้างใหม่
                        
                        const ref = doc(collection(db,'artifacts',DATA_COLLECTION_ID,'transactions'));
                        batch.set(ref, n);
                        addedCount++;
                    }
                }
            });

            // Copy Budget (เฉพาะกรณีเดือนใหม่ซิงๆ เท่านั้น เพื่อไม่ให้ทับข้อมูลที่ User อาจจะแก้ไปแล้ว)
            if(!isNextMonthExist && (settings.salary || settings.savings)) {
                batch.set(doc(db,'settings','monthly'), { [nextM]: settings }, { merge: true });
            }

            // Commit ข้อมูล
            if (addedCount > 0) {
                await batch.commit();
                
                if (!isNextMonthExist) {
                    // ถ้าเป็นเดือนใหม่ เปลี่ยนหน้าหลังจาก Save เสร็จ
                    setTimeout(() => { 
                        setCurrentMonth(nextM); 
                        setMonthOpen(false); 
                    }, 500);
                } else {
                    alert(`✅ เพิ่มรายการที่ขาดหายไปเรียบร้อย: ${addedCount} รายการ`);
                }
            } else {
                if (!isNextMonthExist) {
                     // สร้างเดือนใหม่แต่ไม่มีรายการต้อง Copy ก็เปลี่ยนหน้าปกติ
                     setTimeout(() => { 
                        setCurrentMonth(nextM); 
                        setMonthOpen(false); 
                    }, 500);
                } else {
                    alert("✨ รายการครบถ้วนอยู่แล้ว ไม่มีการเปลี่ยนแปลง");
                }
            }
        } catch (error) {
            console.error("Error creating new month:", error);
            alert("เกิดข้อผิดพลาด: " + error.message);
        } finally {
            // ปลดล็อกปุ่มเสมอ ไม่ว่าจะสำเร็จหรือพัง
            setIsSubmitting(false);
        }
    };

    const saveItem = async (e) => {
        e.preventDefault(); 
        if(!user || isSubmitting) return;
        setIsSubmitting(true);
        const payer = form.group==='Own By หมี' ? 'หมี' : 'แมว';
        const data = { ...form, payer, amount:parseFloat(form.amount)||0, owner:form.splitType==='หาร2'?'Shared':form.owner, monthKey:currentMonth, note: form.note || '' };
        try {
            if(editId) await setDoc(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',editId), data, {merge:true});
            else { data.createdAt = new Date().toISOString(); await addDoc(collection(db,'artifacts',DATA_COLLECTION_ID,'transactions'), data); }
            const futureMonths = getFutureMonths(availableMonths, currentMonth);
            if (futureMonths.length > 0) {
                const futureSameItems = rawTransactions.filter(t => futureMonths.includes(t.monthKey) && t.item === data.item);
                const hasFutureCopies = futureSameItems.length > 0;
                const { hasNext } = getNextInstallmentNote(data.note);
                if (data.isRecurring || hasNext) {
                    if (hasFutureCopies) {
                        if (confirm(`พบรายการ "${data.item}" ในเดือนหน้าจำนวน ${futureSameItems.length} รายการ ต้องการอัปเดตข้อมูลในเดือนหน้าด้วยหรือไม่?`)) {
                            const batch = writeBatch(db);
                            let runningNote = data.note;
                            futureSameItems.forEach(t => {
    // 1. คำนวณงวดใหม่
    const { note } = getNextInstallmentNote(runningNote); 
    runningNote = note;
    
    // 2. คัดกรองข้อมูล (แก้จุดที่ Error)
    // เอา id และ createdAt ทิ้งไป เหลือแต่ข้อมูลเนื้อๆ ใน cleanData
    const { id, createdAt, ...cleanData } = data; 

    // 3. อัปเดตลง DB
    batch.update(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',t.id), { 
        ...cleanData, 
        monthKey: t.monthKey, 
        note: runningNote 
    });
});
                            await batch.commit();
                        } 
                    } else if (confirm(`ต้องการสร้างรายการนี้ล่วงหน้าไปยังเดือนถัดไป (${futureMonths.length} เดือน) หรือไม่?`)) {
                        const batch = writeBatch(db);
                        let runningNote = data.note;
                        futureMonths.forEach(fm => {
                            let shouldAdd = false;
                            const { note, hasNext } = getNextInstallmentNote(runningNote);
                            if(hasNext) { runningNote = note; shouldAdd = true; } else if(data.isRecurring) shouldAdd = true;
                            if(shouldAdd) {
                                const newRef = doc(collection(db,'artifacts',DATA_COLLECTION_ID,'transactions'));
                                batch.set(newRef, { ...data, monthKey: fm, note: runningNote, createdAt: new Date().toISOString() });
                            }
                        });
                        await batch.commit();
                    }
                } else if (!data.isRecurring && hasFutureCopies && confirm(`ยกเลิก Recurring: ต้องการลบรายการเดือนหน้าด้วยไหม?`)) {
                    const batch = writeBatch(db);
                    futureSameItems.forEach(t => batch.delete(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',t.id)));
                    await batch.commit();
                }
            }
            setModal(false);
        } catch(e) { alert('Failed: ' + e.message); } finally { setIsSubmitting(false); }
    };

    const togglePin = useCallback(async (t) => {
        if(!user) return; const newPin = !t.isPinned;
        await updateDoc(doc(db, 'artifacts', DATA_COLLECTION_ID, 'transactions', t.id), { isPinned: newPin });
    }, [user]);

    const delItem = async (id) => { 
        if (!confirm(`ยืนยันการลบ?`)) return;
        try { await deleteDoc(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',id)); } catch(e) { alert('Failed'); }
    }; 

    const openEdit = useCallback((t) => { setEditId(t.id); setForm(t); setModal(true); }, []);
    
    const openBudgetModal = () => {
        setTempBudget({ salary: settings.salary || 0, savings: settings.savings || 0 });
        setBudgetModalOpen(true);
    };

    const handleSaveBudget = async (e) => {
        e.preventDefault();
        if(!user) return;
        await setDoc(doc(db, 'settings', 'monthly'), { 
            [currentMonth]: { ...settings, salary: parseFloat(tempBudget.salary)||0, savings: parseFloat(tempBudget.savings)||0 } 
        }, { merge: true });
        setBudgetModalOpen(false);
    };

    const handleClose = useCallback(() => { if (isSubmitting) return; setModal(false); setTimeout(() => { setEditId(null); setForm(INITIAL_FORM); }, 300); }, [isSubmitting]);
    const handleOpenAdd = () => { setEditId(null); setForm(INITIAL_FORM); setModal(true); };


    // --- RENDER ---
    if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!user) return (
        <div className="flex flex-col h-screen items-center justify-center p-6 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-slate-900 to-slate-900"></div>
            <div className="relative z-10 text-center">
                <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-xl border border-white/10 mb-6 inline-block shadow-2xl">
                    <Icon path={icons.users} size={48} className="text-indigo-400" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Expense Tracker</h1>
                <p className="text-slate-400 mb-8">ระบบจัดการค่าใช้จ่าย หมี & แมว</p>
                <button onClick={handleLogin} className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">เข้าสู่ระบบด้วย Google</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F5F5F7] text-slate-900 font-sans pb-24">
            
            {/* 1. FIXED HEADER (Truly Sticky) */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-[#F5F5F7]/95 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Top Nav */}
                    <div className="h-16 flex justify-between items-center">
                        <div onClick={() => { setFilterYear(parseMonth(currentMonth).y); setMonthOpen(!isMonthOpen); }} className="flex items-center gap-2 cursor-pointer hover:bg-slate-200/50 p-2 rounded-xl transition-colors">
                            <h1 className="text-xl font-bold tracking-tight text-slate-800">{currentMonth}</h1>
                            <Icon path={icons.chevronDown} size={16} className="text-slate-400" />
                        </div>
                        <div className="flex gap-2 items-center">
    {/* ปุ่มเพิ่มรายการใหม่ แบบ iOS Spring Animation */}
    <motion.button 
        whileHover={{ scale: 1.05, backgroundColor: "#1e293b" }} 
        whileTap={{ scale: 0.9, rotate: -5 }} 
        transition={{ type: "spring", stiffness: 400, damping: 17 }} 
        onClick={handleOpenAdd} 
        className="p-2.5 rounded-full bg-slate-900 text-white shadow-md active:shadow-inner transition-all flex items-center justify-center"
    >
        <motion.div
            initial={false}
            animate={{ rotate: isModalOpen ? 135 : 0 }}
        >
            <Icon path={icons.plus} size={20} />
        </motion.div>
    </motion.button>
    
    {/* ปุ่มอื่นๆ */}
    <button onClick={handleStartNewMonth} className="p-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all text-slate-600">
        <Icon path={icons.calendar} size={18} />
    </button>
    <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-100 transition-all text-red-500">
        <Icon path={icons.logout} size={18} />
    </button>
</div>
                    </div>

                    {/* ALWAYS VISIBLE BUDGET CARD */}
                    <div className="pb-4">
                          <BentoCard 
                            title="งบคงเหลือ (แมว)" 
                            value={formatTHB(summary.remaining)} 
                            subValue="แตะเพื่อแก้ไขรายรับ"
                            icon={<Icon path={icons.wallet} size={18}/>}
                            color="bg-gradient-to-br from-[#5B63D8] to-[#7B83EB]" 
                            textColor="text-white"
                            onClick={openBudgetModal}
                        />
                    </div>
                </div>

                {/* Month Dropdown Overlay */}
                <AnimatePresence>
                    {isMonthOpen && (
                        <>
                            <div className="fixed inset-0 z-[60] bg-black/5" onClick={()=>setMonthOpen(false)}></div>
                            <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="absolute top-16 left-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-3 z-[70] w-64">
                                <div className="flex bg-slate-100 rounded-lg p-1 mb-2">{YEARS.map(y=><button key={y} onClick={()=>setFilterYear(y)} className={`flex-1 py-1 text-xs font-bold rounded ${filterYear===y?'bg-white shadow text-slate-900':'text-slate-500'}`}>{y}</button>)}</div>
                                <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">{availableMonths.filter(m=>parseMonth(m).y===filterYear).map(m=><button key={m} onClick={()=>{setCurrentMonth(m);setMonthOpen(false)}} className={`py-2 text-xs rounded-lg ${m===currentMonth?'bg-indigo-50 text-indigo-600 font-bold':'hover:bg-slate-50 text-slate-600'}`}>{m}</button>)}</div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* MAIN CONTENT (Added Padding Top to compensate Fixed Header) */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pt-[220px] md:pt-[240px]">
                
                {/* --- SEPARATE SECTION: Credit Cards & Expenses --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-6">
                      
                      {/* 2. Collapsible Credit Cards (Separate Component Look) */}
                      <div className="lg:col-span-4">
                        <div className={`bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all duration-300 ${isCardsOpen ? 'p-4' : 'p-3 hover:bg-slate-50'}`}>
                            
                            {/* Card Header (Toggle Click) */}
                            <div onClick={() => setCardsOpen(!isCardsOpen)} className="flex justify-between items-center cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ยอดรูดบัตร</h3>
                                    {!isCardsOpen && <span className="text-xs font-bold text-slate-800 ml-2">{formatTHB(summary.cardX+summary.speedy)}</span>}
                                </div>
                                <motion.div animate={{ rotate: isCardsOpen ? 180 : 0 }} className="text-slate-400 bg-slate-100 rounded-full p-1">
                                    <Icon path={icons.chevronDown} size={14} />
                                </motion.div>
                            </div>

                            {/* Collapsible Content */}
                            <AnimatePresence>
                                {isCardsOpen && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }} 
                                        animate={{ height: "auto", opacity: 1, marginTop: 12 }} 
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center p-3 rounded-xl bg-purple-50 border border-purple-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                    <span className="text-purple-700 font-bold text-xs">CardX</span>
                                                </div>
                                                <span className="font-bold text-purple-900 text-sm">{formatTHB(summary.cardX)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 rounded-xl bg-orange-50 border border-orange-100">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                    <span className="text-orange-700 font-bold text-xs">Speedy</span>
                                                </div>
                                                <span className="font-bold text-orange-900 text-sm">{formatTHB(summary.speedy)}</span>
                                            </div>
                                            <div className="pt-2 flex justify-between text-sm px-1 border-t border-slate-100 mt-2">
                                                <span className="text-slate-500 font-bold">รวมยอดรูด</span>
                                                <span className="font-bold text-slate-900 text-sm">{formatTHB(summary.cardX+summary.speedy)}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                      </div>

                      {/* Settlement Section (1. Updated UI to look like Card section) */}
                      <div className="lg:col-span-8">
                        <div className={`bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all duration-300 ${isStatsOpen ? 'p-4' : 'p-3 hover:bg-slate-50'}`}>
                            <div onClick={() => setStatsOpen(!isStatsOpen)} className="flex justify-between items-center cursor-pointer">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">เคลียร์ยอด & หมียัก</span>
                                <motion.div animate={{ rotate: isStatsOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-slate-400 bg-slate-100 rounded-full p-1">
                                    <Icon path={icons.chevronDown} size={14} />
                                </motion.div>
                            </div>
                            
                            <AnimatePresence>
                                {isStatsOpen && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }} 
                                        animate={{ height: "auto", opacity: 1, marginTop: 12 }} 
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Settlement */}
                                            <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm relative overflow-hidden">
                                                <div className="space-y-3 relative z-10">
                                                    <div className="flex justify-between items-center px-2 py-1 bg-red-50 rounded-lg">
                                                        <span className="text-xs font-bold text-red-400">แมวโอนให้หมี</span>
                                                        <span className="font-bold text-red-600 text-sm">{formatTHB(summary.bearPaidForCat)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center px-2 py-1 bg-green-50 rounded-lg">
                                                        <span className="text-xs font-bold text-green-500">หมีโอนให้แมว</span>
                                                        <span className="font-bold text-green-600 text-sm">{formatTHB(summary.catPaidForBear)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bear No Transfer */}
                                            <div className="bg-slate-800 rounded-[20px] p-4 text-white shadow-lg relative overflow-hidden group flex flex-col justify-center">
                                                <div className="relative z-10 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-xs uppercase font-bold text-slate-400 mb-1">หมียักไว้</p>
                                                        <h3 className="text-xl font-bold">{formatTHB(summary.bearNoTransfer)}</h3>
                                                    </div>
                                                    <div className="bg-white/10 p-2 rounded-full backdrop-blur-md group-hover:rotate-12 transition-transform"><span className="text-xl">🐻</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                      </div>
                </div>

                {/* --- TRANSACTIONS LIST (3. Separated Categories) --- */}
                <div className="space-y-10"> {/* เพิ่ม space-y-10 ให้แต่ละก้อนห่างกัน */}
                    {GROUPS.map(grp => {
                        const items = transactions.filter(t => t.group === grp);
                        if(items.length === 0 && grp !== 'อื่นๆ') return null;
                        
                        // Define header style based on group
                        let headerColor = "bg-slate-200";
                        if(grp === 'Own By หมี') headerColor = "bg-indigo-500";
                        else if(grp === 'Own By แมว') headerColor = "bg-pink-500";
                        else if(grp.includes('Shopee')) headerColor = "bg-orange-500";

                        return (
                            <div key={grp} className="break-inside-avoid">
                                {/* 3. Distinct Header Style */}
                                <div className="flex items-center gap-3 mb-4 pl-1">
                                    <div className={`w-1.5 h-6 rounded-full ${headerColor}`}></div>
                                    <h3 className="text-lg font-bold text-slate-800">{grp}</h3>
                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold ml-auto">{formatTHB(summary.groupStats[grp].total)}</span>
                                </div>
                                
                                <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="divide-y divide-slate-100">
                                        <AnimatePresence initial={false}>
                                            {items.map(t => <TransactionItem key={t.id} t={t} onTogglePin={togglePin} onEdit={openEdit} onDelete={delItem} />)}
                                        </AnimatePresence>
                                        {items.length === 0 && <div className="text-center py-8 text-slate-300 text-sm bg-slate-50/50">- ไม่มีรายการ -</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* --- MODAL (Transaction) --- */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-4">
                        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={handleClose}></motion.div>
                        <motion.div 
                            initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:25,stiffness:300}}
                            className="bg-white w-full md:max-w-lg rounded-t-[32px] md:rounded-[32px] p-6 pb-10 md:pb-6 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">{editId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h2>
                                <button onClick={handleClose} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200"><Icon path={icons.x} size={20}/></button>
                            </div>
                            <form onSubmit={saveItem} className="space-y-5">
                                <div className="grid grid-cols-3 gap-2">
                                    {GROUPS.map(g=><button type="button" key={g} onClick={()=>setForm(p=>({...p,group:g,paymentMethod:g==='Shopee Pay'?'':p.paymentMethod}))} className={`py-2 text-[11px] font-bold rounded-xl border transition-all ${form.group===g?'bg-slate-800 text-white border-slate-800 shadow-lg scale-105':'text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{g}</button>)}
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 flex gap-4 items-center border border-slate-100 focus-within:ring-2 ring-indigo-100 transition-all">
                                    <span className="text-slate-400 font-bold">฿</span>
                                    <input autoFocus={!editId} required type="number" step="0.01" inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="bg-transparent text-3xl font-bold text-slate-900 w-full outline-none placeholder-slate-200" placeholder="0.00"/>
                                </div>
                                <input required value={form.item} onChange={e=>setForm({...form,item:e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-4 font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="ชื่อรายการ..."/>
                                
                                <div className="flex gap-3">
                                    <div className="flex-1 bg-slate-50 rounded-xl p-1 flex">
                                        {['เดี่ยว','หาร2'].map(t=><button key={t} type="button" onClick={()=>setForm({...form,splitType:t})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.splitType===t?'bg-white shadow text-slate-900':'text-slate-400'}`}>{t}</button>)}
                                    </div>
                                    {form.splitType==='เดี่ยว' && <div className="flex-1 flex gap-2">{USERS.map(u=><button key={u} type="button" onClick={()=>setForm({...form,owner:u})} className={`flex-1 rounded-xl text-xs font-bold border-2 transition-all ${form.owner===u?'border-indigo-500 bg-indigo-50 text-indigo-600':'border-slate-100 bg-white text-slate-400'}`}>{u}</button>)}</div>}
                                </div>

                                <div className="flex gap-3">
                                    {form.group !== 'Shopee Pay' && <div className="w-1/3"><select value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})} className="w-full h-full bg-slate-50 rounded-xl px-3 text-xs font-bold text-slate-600 outline-none"><option value="">เงินสด/โอน</option><option value="CardX">CardX 🟣</option><option value="Speedy">Speedy 🟠</option></select></div>}
                                    <input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none" placeholder="Note / งวด (1/10)"/>
                                </div>

                                <div className="flex items-center gap-3 pt-2 cursor-pointer" onClick={()=>setForm(p=>({...p,isRecurring:!p.isRecurring}))}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.isRecurring?'bg-slate-900 border-slate-900':'bg-white border-slate-300'}`}>{form.isRecurring && <Icon path={icons.check} size={14} className="text-white"/>}</div>
                                    <span className="text-sm font-medium text-slate-600">ตั้งเป็นรายการประจำ (Recurring)</span>
                                </div>

                                <button disabled={isSubmitting} type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-transform disabled:opacity-50 mt-4">{isSubmitting ? 'Saving...' : 'บันทึก'}</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

             {/* --- MODAL (Budget Settings) --- */}
             <AnimatePresence>
                {isBudgetModalOpen && (
                    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={()=>setBudgetModalOpen(false)}></motion.div>
                        <motion.div 
                            initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}}
                            className="bg-white w-full max-w-sm rounded-[32px] p-6 relative z-10 shadow-2xl text-center"
                        >
                            <h3 className="text-xl font-bold text-slate-800 mb-1">ตั้งค่ารายรับ</h3>
                            <p className="text-slate-400 text-sm mb-6">ระบุเงินเดือนและเงินเก็บประจำเดือนนี้</p>
                            
                            <form onSubmit={handleSaveBudget} className="space-y-4">
                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-slate-500 ml-2">เงินเดือน (Salary)</label>
                                    <input type="number" value={tempBudget.salary} onChange={e=>setTempBudget({...tempBudget,salary:e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                                </div>
                                <div className="space-y-1 text-left">
                                    <label className="text-xs font-bold text-slate-500 ml-2">เงินเก็บ (Savings)</label>
                                    <input type="number" value={tempBudget.savings} onChange={e=>setTempBudget({...tempBudget,savings:e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
                                </div>
                                
                                <div className="flex gap-2 mt-6">
                                    <button type="button" onClick={()=>setBudgetModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">ยกเลิก</button>
                                    <button type="submit" className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all">บันทึก</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;