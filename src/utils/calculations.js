// src/utils/calculations.js

// --- CONSTANTS ---
export const GROUPS = ['Own By หมี', 'Shopee Pay', 'Laz Pay', 'True Money Pay Next', 'Bill Payment', 'อื่นๆ'];
export const USERS = ['หมี', 'แมว'];
export const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const YEARS = [2024, 2025, 2026, 2027];
export const ALLOWED_EMAILS = ["pixkazaa@gmail.com", "natchanun.thb@gmail.com", "viviennenatachaaroyo@gmail.com"];

// --- FORMATTERS ---
export const formatTHB = (n) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);

// --- DATE / MONTH LOGIC ---
export const getCurrentRealMonth = () => { const d=new Date(); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

export const parseMonth = (str) => { 
    if(!str) return {m:0, y:2026}; 
    const p = str.split(" "); 
    return { m: MONTHS.indexOf(p[0]), y: parseInt(p[1]) || 2026 }; 
};

export const getNextMonthName = (curr) => { 
    const { m, y } = parseMonth(curr); 
    let nM = m+1, nY = y; 
    if(nM>11){nM=0; nY++;} 
    return `${MONTHS[nM]} ${nY}`; 
};

export const isMonthAfter = (m1, m2) => { 
    const d1=parseMonth(m1), d2=parseMonth(m2); 
    return (d1.y>d2.y)||(d1.y===d2.y&&d1.m>d2.m); 
};

export const getFutureMonths = (availableMonths, currentMonth) => {
    return availableMonths.filter(m => isMonthAfter(m, currentMonth)).sort((a,b) => {
        const pa=parseMonth(a), pb=parseMonth(b); return (pa.y-pb.y)||(pa.m-pb.m); 
   });
};

export const getSortedAvailableMonths = (rawTransactions, currentMonth) => {
    const s = new Set(rawTransactions.map(t => t.monthKey)); 
    s.add(currentMonth);
    return Array.from(s).sort((a,b) => { 
        const pa=parseMonth(a), pb=parseMonth(b); 
        return (pb.y-pa.y)||(pb.m-pa.m); 
    });
};

// --- TRANSACTION LOGIC ---
export const getSortedTransactions = (rawTransactions, currentMonth) => {
    const list = rawTransactions.filter(t => t.monthKey === currentMonth);
    return list.sort((a,b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
};

// คำนวณยอดรวมต่างๆ (แยก Logic ที่ยาวที่สุดออกมา)
export const calculateSummary = (transactions, settings) => {
    let bearTotal=0, catTotal=0, bearPaidForCat=0, catPaidForBear=0, total=0, cardX=0, speedy=0;
    let groupStats = {};
    GROUPS.forEach(g => groupStats[g] = { total: 0, bear: 0, cat: 0 });
    groupStats['อื่นๆ'] = { total: 0, bear: 0, cat: 0 };

    transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        total += amt;
        let bearC=0, catC=0;
        
        // คำนวณส่วนแบ่ง
        if (t.owner==='Shared') { bearC=amt/2; catC=amt/2; } 
        else if (t.owner==='หมี') bearC=amt; 
        else catC=amt;
        
        bearTotal+=bearC; catTotal+=catC;
        
        // คำนวณหนี้สิน (ใครจ่ายให้ใคร)
        if (t.group === 'Own By หมี') { 
            if (t.owner === 'แมว' || t.owner === 'Shared') bearPaidForCat += catC; 
        } else if (t.group === 'อื่นๆ') { // แมวจ่าย (สมมติกลุ่มอื่นๆ คือแมวจ่าย ถ้าไม่ใช่ต้องปรับ Logic ตามความเป็นจริงของ User)
             if (t.owner === 'Shared') catPaidForBear += bearC;
        } else { // กลุ่มที่เหลือ (Shopee, Laz, etc.) ปกติใครจ่าย? (ใน Code เก่า logic นี้ซับซ้อน ถ้า User ใช้ App.jsx เดิม logic นี้คือตามเดิม)
            // ตาม Code เดิม:
            if (t.owner === 'หมี' || t.owner === 'Shared') catPaidForBear += bearC; 
        }
        
        // ยอดบัตรเครดิต
        if (t.group!=='Shopee Pay') { 
            if(t.paymentMethod==='CardX') cardX+=amt; 
            if(t.paymentMethod==='Speedy') speedy+=amt; 
        }

        // รวมยอดตามกลุ่ม
        let gName = groupStats[t.group] ? t.group : 'อื่นๆ';
        groupStats[gName].total+=amt; groupStats[gName].bear+=bearC; groupStats[gName].cat+=catC;
    });

    const net = catPaidForBear - bearPaidForCat;
    
    return { 
        bearTotal, catTotal, total, net, 
        absNet: Math.abs(net), 
        remaining: (settings.salary||0) - (settings.savings||0) - catTotal, 
        cardX, speedy, groupStats, 
        bearPaidForCat, catPaidForBear, 
        bearNoTransfer: bearTotal - catPaidForBear 
    };
};

// Logic สำหรับคำนวณ Note งวดถัดไป (เช่น 1/10 -> 2/10)
export const getNextInstallmentNote = (currentNote) => {
    if (!currentNote) return { note: '', hasNext: false };
    const m = currentNote.match(/(\d+)\/(\d+)/);
    if (m) {
        const current = parseInt(m[1]);
        const total = parseInt(m[2]);
        if (current < total) {
            return { note: currentNote.replace(`${current}/${total}`, `${current+1}/${total}`), hasNext: true };
        }
    }
    return { note: currentNote, hasNext: false }; // ไม่ใช่ format งวดผ่อน หรือ ครบงวดแล้ว
};