import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion"; 
import './index.css';

// 👇 IMPORT จากไฟล์ใหม่
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

// --- CONSTANTS & ICONS ---
const INITIAL_FORM = { group: 'Own By หมี', item: '', amount: '', splitType: 'เดี่ยว', owner: 'แมว', note: '', isRecurring: false, paymentMethod: '' };
const DATA_COLLECTION_ID = 'personal-expenses-tracker'; 

// (Icon Component ยังคงเดิมเพื่อความสะดวกในการอ่านไฟล์นี้ แต่ถ้าอยากแยกก็ได้ครับ)
const Icon = memo(({ path, size = 18, className = "" }) => (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>{path}</svg>));
const icons = {
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></>,
    trash: <><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></>,
    next: <><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></>,
    creditCard: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"></polyline></>,
    chevronUp: <><polyline points="18 15 12 9 6 15"></polyline></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>,
    info: <><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>,
    pin: <><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></>,
    pinFilled: <><path d="M16.9 15.24l1.78.9A2 2 0 0 0 19 15.24V17H5v-1.76a2 2 0 0 0 .31-.98l1.78-.9A2 2 0 0 1 8 11.76V6h1a2 2 0 0 0 0-4h6a2 2 0 0 0 0 4h1v5.76a2 2 0 0 1 .9 1.48zM12 22v-5"></path></>
};

// --- COMPONENT: TransactionItem (UI Only) ---
const TransactionItem = memo(({ t, onTogglePin, onEdit, onDelete }) => {
    return (
        <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className={`bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex justify-between relative overflow-hidden active:scale-[0.98] transition-transform ${t.isPinned?'border-l-4 border-l-indigo-500 bg-indigo-50/30':''}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.isPinned?'hidden':(t.owner==='Shared'?'bg-purple-400':(t.payer===t.owner?'bg-slate-200':'bg-red-400'))}`}></div>
            <div className="flex-1 pl-2.5 pr-2 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800 text-sm truncate">{t.item}</span>
                    {t.isPinned && <Icon path={icons.pin} size={12} className="text-indigo-500 rotate-45 flex-shrink-0"/>}
                    {t.note && (t.note.includes('/') ? <span className="bg-pink-50 text-pink-600 text-[9px] px-1.5 border border-pink-100 rounded whitespace-nowrap">{t.note}</span> : null)}
                    {t.paymentMethod && <span className={`text-[9px] px-1.5 border rounded whitespace-nowrap ${t.paymentMethod === 'CardX' ? 'bg-purple-100 text-purple-600 border-purple-200' : t.paymentMethod === 'Speedy' ? 'bg-orange-100 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{t.paymentMethod}</span>}
                </div>
                <div className="flex gap-1 flex-wrap">
                    {t.splitType==='หาร2' ? 
                        <span className="text-[10px] px-1.5 border rounded font-bold bg-purple-50 text-purple-600 border-purple-100">หาร 2 = {formatTHB(t.amount/2)}</span> 
                        : <><span className="text-[10px] px-1.5 border rounded font-bold bg-slate-50 text-slate-500 border-slate-100">เดี่ยว</span><span className={`text-[10px] px-1.5 border rounded font-bold ${t.owner==='หมี'?'bg-blue-50 text-blue-600 border-blue-100':'bg-pink-50 text-pink-600 border-pink-100'}`}>{t.owner}</span></>
                    }
                    {t.note && !t.note.includes('/') && <p className="text-[10px] text-slate-400 mt-0.5 ml-1 truncate max-w-full">{t.note}</p>}
                </div>
            </div>
            <div className="text-right flex flex-col justify-between">
                <p className="font-bold text-slate-800">{formatTHB(t.amount)}</p>
                <div className="flex justify-end gap-3 mt-1 opacity-60">
                    <button onClick={(e)=>{e.stopPropagation();onTogglePin(t)}} className={`transform transition-transform p-1 -mr-1 ${t.isPinned?'text-indigo-500 scale-110':'text-slate-300 hover:text-indigo-400'}`}><Icon path={t.isPinned?icons.pinFilled:icons.pin} size={14}/></button>
                    <button onClick={(e)=>{e.stopPropagation();onEdit(t)}} className="text-slate-400 hover:text-blue-500 p-1 -mr-1"><Icon path={icons.edit} size={14}/></button>
                    <button onClick={(e)=>{e.stopPropagation();onDelete(t.id)}} className="text-slate-400 hover:text-red-500 p-1 -mr-1"><Icon path={icons.trash} size={14}/></button>
                </div>
            </div>
        </motion.div>
    );
});

function App() {
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
    const [isBalanceOpen, setBalanceOpen] = useState(false);
    const [isDetail, setDetail] = useState(false);
    const [isCredit, setCredit] = useState(false);
    const [form, setForm] = useState(INITIAL_FORM);

    useEffect(() => {
        if (isModalOpen) document.body.style.overflow = 'hidden'; else document.body.style.overflow = '';
        return () => document.body.style.overflow = '';
    }, [isModalOpen]);

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

    // -- LOGIC: ใช้ฟังก์ชันจาก calculations.js --
    const transactions = useMemo(() => getSortedTransactions(rawTransactions, currentMonth), [rawTransactions, currentMonth]);
    const availableMonths = useMemo(() => getSortedAvailableMonths(rawTransactions, currentMonth), [rawTransactions, currentMonth]);
    const summary = useMemo(() => calculateSummary(transactions, settings), [transactions, settings]);

    // -- Handlers --
    const handleLogin = async () => { const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); } catch(e) { try { await signInWithRedirect(auth, provider); } catch (e2) { alert("Login Failed"); } } };
    const handleLogout = () => signOut(auth);

    const handleStartNewMonth = async () => {
        const nextM = getNextMonthName(currentMonth);
        if (availableMonths.includes(nextM)) { setCurrentMonth(nextM); setMonthOpen(false); return; }
        if (!confirm(`ยืนยันขึ้นเดือนใหม่ ${nextM}?`)) return;
        setIsSubmitting(true);
        const batch = writeBatch(db);
        transactions.forEach(t => {
            // ใช้ Helper คำนวณ note ใหม่
            let nextNote = t.note || '';
            let keep = false;
            
            const { note, hasNext } = getNextInstallmentNote(nextNote);
            if(hasNext) { nextNote = note; keep = true; }
            else if(t.isRecurring) keep = true;

            if(keep) { 
                const n={...t, note: nextNote, monthKey:nextM, createdAt:new Date().toISOString(), isPinned: t.isPinned||false}; 
                delete n.id; 
                const ref = doc(collection(db,'artifacts',DATA_COLLECTION_ID,'transactions'));
                batch.set(ref, n);
            }
        });
        if(settings.salary||settings.savings) batch.set(doc(db,'settings','monthly'),{[nextM]:settings},{merge:true});
        await batch.commit();
        setTimeout(() => { setCurrentMonth(nextM); setMonthOpen(false); setIsSubmitting(false); }, 1000);
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

            // -- Logic จัดการเดือนอนาคต (ใช้ Helper ช่วยหาเดือน) --
            const futureMonths = getFutureMonths(availableMonths, currentMonth);

            if (futureMonths.length > 0) {
                const futureSameItems = rawTransactions.filter(t => futureMonths.includes(t.monthKey) && t.item === data.item);
                const hasFutureCopies = futureSameItems.length > 0;
                const { hasNext } = getNextInstallmentNote(data.note); // เช็คว่าเป็นงวดผ่อนไหม

                if (data.isRecurring || hasNext) {
                    if (hasFutureCopies) {
                        if (confirm(`พบรายการ "${data.item}" ในเดือนหน้าจำนวน ${futureSameItems.length} รายการ\nต้องการอัปเดตข้อมูลในเดือนหน้าด้วยหรือไม่?\n(OK = แก้ทั้งหมด / Cancel = แก้แค่เดือนนี้)`)) {
                            const batch = writeBatch(db);
                            let runningNote = data.note;
                            futureSameItems.forEach(t => {
                                const { note } = getNextInstallmentNote(runningNote); // คำนวณงวดถัดไปอัตโนมัติ
                                runningNote = note; // update running note
                                batch.update(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',t.id), { ...data, monthKey: t.monthKey, note: runningNote, id: undefined, createdAt: undefined });
                            });
                            await batch.commit();
                        } 
                    } else {
                        if (confirm(`ตั้งเป็นรายการต่อเนื่อง\nต้องการสร้างรายการนี้ล่วงหน้าไปยังเดือนถัดไป (${futureMonths.length} เดือน) หรือไม่?`)) {
                            const batch = writeBatch(db);
                            let runningNote = data.note;
                            futureMonths.forEach(fm => {
                                let shouldAdd = false;
                                const { note, hasNext } = getNextInstallmentNote(runningNote);
                                if(hasNext) { runningNote = note; shouldAdd = true; }
                                else if(data.isRecurring) shouldAdd = true;

                                if(shouldAdd) {
                                    const newRef = doc(collection(db,'artifacts',DATA_COLLECTION_ID,'transactions'));
                                    batch.set(newRef, { ...data, monthKey: fm, note: runningNote, createdAt: new Date().toISOString() });
                                }
                            });
                            await batch.commit();
                        }
                    }
                } else { // ถ้าเอา Recurring ออก
                    if (hasFutureCopies && confirm(`คุณยกเลิกรายการต่อเนื่องแล้ว\nต้องการ "ลบ" รายการ "${data.item}" ในเดือนถัดไป (${futureSameItems.length} รายการ) ออกด้วยหรือไม่?`)) {
                        const batch = writeBatch(db);
                        futureSameItems.forEach(t => batch.delete(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',t.id)));
                        await batch.commit();
                    }
                }
            }
            setModal(false);
        } catch(e) { alert('Failed: ' + e.message); } finally { setIsSubmitting(false); }
    };

    const togglePin = useCallback(async (t) => {
        if(!user) return; const newPin = !t.isPinned;
        await updateDoc(doc(db, 'artifacts', DATA_COLLECTION_ID, 'transactions', t.id), { isPinned: newPin });
        const { hasNext } = getNextInstallmentNote(t.note);
        if((t.isRecurring || hasNext) && confirm(`ต้องการ ${newPin?'ปักหมุด':'เลิกปัก'} รายการนี้ในเดือนอนาคตด้วยไหม?`)) {
            const batch = writeBatch(db);
            const future = rawTransactions.filter(f => f.item === t.item && isMonthAfter(f.monthKey, currentMonth));
            future.forEach(f => batch.update(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',f.id), { isPinned: newPin }));
            if(future.length>0) await batch.commit();
        }
    }, [user, rawTransactions, currentMonth]);

    const delItem = async (id) => { 
        const itemToDelete = rawTransactions.find(t => t.id === id);
        if (!itemToDelete || !confirm(`ยืนยันการลบรายการ "${itemToDelete.item}"?`)) return;
        try {
            await deleteDoc(doc(db,'artifacts',DATA_COLLECTION_ID,'transactions',id)); 
            const futureItems = rawTransactions.filter(t => t.item === itemToDelete.item && isMonthAfter(t.monthKey, currentMonth));
            if (futureItems.length > 0 && confirm(`ลบรายการเรียบร้อย\nพบรายการ "${itemToDelete.item}" ในเดือนหน้าอีก ${futureItems.length} รายการ\nต้องการลบทั้งหมดด้วยไหม?`)) { 
                const batch = writeBatch(db); 
                futureItems.forEach(t => batch.delete(doc(db, 'artifacts', DATA_COLLECTION_ID, 'transactions', t.id))); 
                await batch.commit(); 
            }
        } catch(e) { alert('ลบไม่สำเร็จ: ' + e.message); }
    }; 

    const openEdit = useCallback((t) => { setEditId(t.id); setForm(t); setModal(true); }, []);
    const handleLocalUpdate = (k, v) => setSettings(p => ({...p, [k]: parseFloat(v) || 0}));
    const handleSaveToDb = async (k, v) => { if(!user) return; await setDoc(doc(db, 'settings', 'monthly'), { [currentMonth]: { ...settings, [k]: parseFloat(v)||0 } }, { merge: true }); };
    const handleClose = useCallback(() => { if (isSubmitting) return; setModal(false); setTimeout(() => { setEditId(null); setForm(INITIAL_FORM); }, 300); }, [isSubmitting]);
    const handleOpenAdd = () => { setEditId(null); setForm(INITIAL_FORM); setModal(true); };

    // -- Renders (AppSkeleton & JSX) ยังเหมือนเดิม --
    const AppSkeleton = () => (<div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative"><div className="bg-slate-50 pt-5 pb-6 px-5 rounded-b-[30px] shadow-sm"><div className="flex justify-between mb-4"><div className="h-9 w-32 skeleton"></div><div className="h-9 w-24 skeleton"></div></div><div className="flex gap-3 mb-3"><div className="flex-1 h-36 skeleton rounded-2xl"></div><div className="flex-1 h-36 skeleton rounded-2xl"></div></div></div><div className="px-4 py-6 space-y-6">{[1,2,3].map(i=><div key={i} className="space-y-3"><div className="flex justify-between items-end px-1"><div className="h-4 w-24 skeleton rounded"></div><div className="h-3 w-16 skeleton rounded"></div></div><div className="bg-white border border-slate-100 rounded-xl p-4 h-24 skeleton"></div></div>)}</div></div>);

    if (isLoading) return <AppSkeleton />;
    if (!user) return <div className="flex flex-col h-screen items-center justify-center p-6 bg-slate-50"><motion.div initial={{scale:0.8,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center"><div className="bg-indigo-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 text-indigo-600"><Icon path={icons.users} size={40}/></div><h1 className="text-2xl font-bold text-slate-800 mb-2">Personal Expense</h1><p className="text-slate-500 mb-6 text-sm">ระบบจัดการค่าใช้จ่าย หมี & แมว<br/>กรุณาล็อกอินเพื่อเข้าใช้งาน</p><button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95">เข้าสู่ระบบด้วย Google</button></motion.div></div>;

    return (
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative flex flex-col pb-24">
            <motion.header initial={{y:-20,opacity:0}} animate={{y:0,opacity:1}} className="bg-slate-900 text-white pt-5 pb-6 px-5 rounded-b-[30px] shadow-lg flex-none fixed top-0 left-0 right-0 mx-auto w-full max-w-md z-30">
                <div className="flex justify-between items-center mb-4">
                    <div onClick={()=>{setFilterYear(parseMonth(currentMonth).y);setMonthOpen(!isMonthOpen)}} className="flex items-center gap-2 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 active:scale-95 transition-transform"><Icon path={icons.calendar} size={16} className="text-slate-400"/><div className="text-sm font-bold ml-1">{currentMonth} <Icon path={icons.chevronDown} size={10} className="inline opacity-50"/></div></div>
                    <div className="flex gap-2"><button disabled={isSubmitting} onClick={handleStartNewMonth} className="text-[10px] bg-blue-600 px-3 py-2 rounded-xl font-bold flex gap-1 items-center shadow-lg active:scale-95 transition-all disabled:opacity-50">ขึ้นรอบบิล <Icon path={icons.next} size={10}/></button><button onClick={handleLogout} className="bg-red-500/20 hover:bg-red-500/40 p-2 rounded-xl text-red-200 transition-all active:scale-95"><Icon path={icons.logout} size={16}/></button></div>
                    <AnimatePresence>{isMonthOpen && (<><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]" onClick={()=>setMonthOpen(false)}></motion.div><motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}} className="absolute top-16 left-5 w-64 bg-white rounded-xl shadow-2xl border text-slate-800 z-50 overflow-hidden origin-top-left"><div className="flex border-b">{YEARS.map(y=><button key={y} onClick={()=>setFilterYear(y)} className={`flex-1 py-2 text-xs font-bold transition-colors ${filterYear===y?'bg-indigo-50 text-indigo-600':'text-slate-400 hover:bg-slate-50'}`}>{y}</button>)}</div><div className="max-h-60 overflow-y-auto p-2 scroll-smooth">{availableMonths.filter(m=>parseMonth(m).y===filterYear).map(m=><div key={m} onClick={()=>{setCurrentMonth(m);setMonthOpen(false)}} className={`px-3 py-2 rounded text-sm cursor-pointer ${m===currentMonth?'bg-indigo-600 text-white':'hover:bg-slate-50'}`}>{m}</div>)}</div></motion.div></>)}</AnimatePresence>
                </div>

                <div className="flex gap-3 mb-1">
                    <motion.div onClick={() => setBalanceOpen(!isBalanceOpen)} whileHover={{scale:1.02}} whileTap={{scale:0.98}} className="flex-1 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-3 border border-indigo-500/50 shadow-lg flex flex-col justify-between cursor-pointer relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start"><span className="text-[10px] text-indigo-200 font-bold uppercase">งบคงเหลือ (แมว)</span><div className="inline-flex items-center gap-1 text-[9px] text-indigo-200 bg-indigo-800/30 px-2 py-0.5 rounded-full"><Icon path={icons.edit} size={8}/> ปรับยอด</div></div>
                            <div className={`text-2xl font-bold mt-1 ${summary.remaining<0?'text-red-300':'text-white'}`}>{formatTHB(summary.remaining)}</div>
                        </div>
                        <AnimatePresence>{isBalanceOpen && (<motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 8 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden" onClick={(e) => e.stopPropagation()}><div className="flex gap-2"><div className="flex-1"><label className="text-[8px] text-indigo-300 block">รับ</label><input type="number" value={settings.salary} onChange={e => handleLocalUpdate('salary', e.target.value)} onBlur={e => handleSaveToDb('salary', e.target.value)} className="w-full bg-indigo-900/30 text-white text-xs rounded text-center outline-none focus:bg-indigo-900/50 transition-colors py-0.5" /></div><div className="flex-1"><label className="text-[8px] text-indigo-300 block">เก็บ</label><input type="number" value={settings.savings} onChange={e => handleLocalUpdate('savings', e.target.value)} onBlur={e => handleSaveToDb('savings', e.target.value)} className="w-full bg-indigo-900/30 text-white text-xs rounded text-center outline-none focus:bg-indigo-900/50 transition-colors py-0.5" /></div></div></motion.div>)}</AnimatePresence>
                    </motion.div>

                    <motion.div whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>setDetail(!isDetail)} className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-lg relative cursor-pointer hover:bg-slate-750 overflow-hidden flex flex-col justify-center text-center">
                        <div className="relative z-10"><p className="text-[10px] text-slate-400 uppercase mb-1">รายจ่ายส่วนตัวแมว</p><h2 className="text-xl font-bold text-white mb-1">{formatTHB(summary.catTotal)}</h2><div className="inline-flex items-center gap-1 text-[9px] text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full"><Icon path={icons.info} size={10}/> รายละเอียด</div></div>
                        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-pink-500 rounded-full blur-xl opacity-20"></div>
                    </motion.div>
                </div>
                
                <AnimatePresence>{isDetail && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="bg-white rounded-xl p-3 text-xs space-y-2 border border-slate-200 shadow-lg text-slate-800 mt-3 mx-1"><div className="flex justify-between border-b border-slate-100 pb-2"><span>ค่าใช้จ่ายรวม (ทั้งหมด)</span><span className="font-bold text-slate-800">{formatTHB(summary.total)}</span></div><div className="flex justify-between border-b border-slate-100 pb-2"><span>แมวโอนให้หมี (หนี้แมว)</span><span className="font-bold text-indigo-600">{formatTHB(summary.bearPaidForCat)}</span></div><div className="flex justify-between border-b border-slate-100 pb-2"><span>หมีโอนให้แมว (หนี้หมี)</span><span className="font-bold text-indigo-600">{formatTHB(summary.catPaidForBear)}</span></div><div className="flex pt-1 text-center gap-2"><div className="flex-1 bg-slate-50 p-2 rounded"><span className="block text-[9px] text-slate-400 mb-1">ค่าใช้จ่ายหมี</span><span className="font-bold text-slate-600 block">{formatTHB(summary.bearTotal)}</span></div><div className="flex-1 bg-pink-50 p-2 rounded"><span className="block text-[9px] text-pink-400 mb-1">หมียักไว้</span><span className="font-bold text-pink-600 block">{formatTHB(summary.bearNoTransfer)}</span></div></div></div></motion.div>}</AnimatePresence>
            </motion.header>

            <main className="px-4 py-4 space-y-4 pt-[240px]">
                {GROUPS.map(grp => {
                    const items = transactions.filter(t => t.group === grp);
                    const stats = summary.groupStats[grp];
                    if(items.length === 0 && grp !== 'อื่นๆ') return null;
                    return (
                        <motion.section key={grp} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
                            <div className="flex justify-between items-end mb-2 px-1"><div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${grp==='Own By หมี'?'bg-indigo-500':'bg-pink-500'}`}></span><h3 className="text-xs font-bold text-slate-700 uppercase">{grp}</h3></div><div className="text-right leading-none"><span className="text-[10px] font-bold text-slate-600 block">รวม {formatTHB(stats.total)}</span></div></div>
                            <div className="space-y-2"><AnimatePresence>{items.map(t=><TransactionItem key={t.id} t={t} onTogglePin={togglePin} onEdit={openEdit} onDelete={delItem} />)}</AnimatePresence></div>
                        </motion.section>
                    );
                })}
                {transactions.length === 0 && <div className="text-center py-12 text-slate-300 text-sm">ยังไม่มีรายการในเดือนนี้</div>}
            </main>

            <motion.div initial={{y:100}} animate={{y:0}} className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white border-t border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] rounded-t-2xl pb-safe">
                <div onClick={()=>setCredit(!isCredit)} className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors active:bg-slate-100"><div className="flex gap-2 items-center"><div className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><Icon path={icons.creditCard}/></div><div><span className="text-[10px] font-bold text-slate-400 uppercase block">ยอดรูดบัตร</span><span className="text-xs font-bold text-slate-800">{formatTHB(summary.cardX + summary.speedy)}</span></div></div><motion.div animate={{ rotate: isCredit ? 180 : 0 }} transition={{ duration: 0.2 }}><Icon path={icons.chevronDown} size={16} className="text-slate-400"/></motion.div></div>
                <AnimatePresence>{isCredit && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 40 }} className="overflow-hidden"><div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-2 text-xs"><div className="flex justify-between"><span className="text-purple-700 font-bold">CardX</span><span className="font-bold">{formatTHB(summary.cardX)}</span></div><div className="flex justify-between"><span className="text-orange-700 font-bold">Speedy</span><span className="font-bold">{formatTHB(summary.speedy)}</span></div></div></motion.div>)}</AnimatePresence>
            </motion.div>

            <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={handleOpenAdd} className={`fixed right-5 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-50 transition-all ${isCredit?'bottom-44':'bottom-24'}`}><Icon path={icons.plus} size={28}/></motion.button>
            <AnimatePresence>{isModalOpen && (<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose}></motion.div><motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring', damping:25, stiffness:300}} className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl px-6 pt-6 pb-9 relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"><div className="flex justify-between mb-6 items-center"><h3 className="font-bold text-xl text-slate-800">{editId?'แก้ไขรายการ':'เพิ่มรายการ'}</h3><button disabled={isSubmitting} onClick={handleClose} className="text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200"><Icon path={icons.x}/></button></div><form onSubmit={saveItem} className="space-y-5"><div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">หมวดหมู่</label><div className="grid grid-cols-2 gap-2">{GROUPS.map(g=><button type="button" key={g} onClick={()=>{setForm(p=>({...p,group:g,paymentMethod:g==='Shopee Pay'?'':p.paymentMethod}))}} className={`py-2 px-2 text-xs rounded-lg border font-bold transition-all ${form.group===g?'bg-slate-800 text-white border-slate-800 shadow-md':'text-slate-500 border-slate-200'}`}>{g}</button>)}</div></div>{form.group !== 'Shopee Pay' && <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">ช่องทางจ่าย</label><div className="flex gap-2 bg-slate-50 p-1 rounded-xl">{['', 'CardX', 'Speedy'].map(m=><button key={m} type="button" onClick={()=>setForm({...form, paymentMethod: m})} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${form.paymentMethod===m?'bg-white text-slate-800 shadow-sm border border-slate-100':'text-slate-400'}`}>{m||'เงินสด/โอน'}</button>)}</div></div>}<div className="flex gap-3"><div className="flex-[2]"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">รายการ</label><input required value={form.item} onChange={e=>setForm({...form,item:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all" placeholder="ชื่อรายการ" autoComplete="off"/></div><div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">ยอดเงิน</label><input required type="number" step="0.01" inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-right" placeholder="0.00" /></div></div><div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><label className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex justify-between items-center"><span>คิดตังค์ที่ใคร</span>{form.splitType==='หาร2' && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px]">หาร 2 = {formatTHB((parseFloat(form.amount)||0)/2)}</span>}</label><div className="flex gap-3"><div className="flex flex-col gap-2 border-r border-slate-200 pr-3"><label className="flex items-center gap-2 cursor-pointer group"><input type="radio" checked={form.splitType==='เดี่ยว'} onChange={()=>setForm({...form,splitType:'เดี่ยว'})} className="accent-slate-900 w-4 h-4"/><span className="text-xs font-bold group-active:scale-95 transition-transform">เดี่ยว</span></label><label className="flex items-center gap-2 cursor-pointer group"><input type="radio" checked={form.splitType==='หาร2'} onChange={()=>setForm({...form,splitType:'หาร2'})} className="accent-slate-900 w-4 h-4"/><span className="text-xs font-bold text-purple-600 group-active:scale-95 transition-transform">หาร 2</span></label></div><div className="flex-1 flex items-center">{form.splitType==='เดี่ยว' ? (<div className="flex gap-2 w-full">{USERS.map(u=><button key={u} type="button" onClick={()=>setForm({...form,owner:u})} className={`flex-1 py-2.5 text-xs rounded-xl border font-bold transition-all active:scale-95 ${form.owner===u?'bg-slate-800 text-white shadow-lg':'text-slate-400 bg-white border-slate-200'}`}>{u}</button>)}</div>) : <div className="w-full text-xs text-purple-700 font-bold bg-purple-100/50 border border-purple-100 h-full rounded-xl flex items-center justify-center gap-2"><Icon path={icons.users} size={16}/> รายการหารกัน</div>}</div></div></div><div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Note / งวดผ่อน (2/10)</label><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all" placeholder="ระบุเพิ่มเติม..." autoComplete="off"/></div><div className="flex items-center gap-2 pt-2"><input type="checkbox" id="rec" checked={form.isRecurring} onChange={e=>setForm({...form,isRecurring:e.target.checked})} className="accent-slate-900 w-5 h-5 rounded"/><label htmlFor="rec" className="text-sm text-slate-600 cursor-pointer select-none">ตั้งเป็นรายการประจำทุกเดือน (Recurring)</label></div><button disabled={isSubmitting} type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-base shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8">{isSubmitting ? 'กำลังบันทึก...' : (editId ? 'อัปเดตรายการ' : 'บันทึกรายการ')}</button><div className="h-6"></div></form></motion.div></div>)}</AnimatePresence>
        </div>
    );
}

export default App;