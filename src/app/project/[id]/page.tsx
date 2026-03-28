'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, Plus, Trash2, Pencil, Check, FileSpreadsheet, Image, FileText, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { NumberInput } from '@/components/number-input';
import { 
  ProjectData, 
  ProjectType, 
  AccommodationType, 
  StaffMember, 
  TransportItem,
  MaterialItem, 
  OtherExpenseItem,
  ACCOMMODATION_TYPE_LABELS, 
  DEFAULT_MEAL_CONFIG,
  DEFAULT_STAFF_MEMBERS,
  DEFAULT_OTHER_EXPENSES,
  DEFAULT_INSURANCE_CONFIG
} from '@/types';
import { getProjectData, updateProjectData } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { calculateCostSummary, calculateServiceFee, formatMoney } from '@/lib/calculation';
import { exportToExcel, exportElementAsImage, exportElementAsPDF } from '@/lib/export';

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'half-day', label: '半日' },
  { value: 'one-day', label: '一日' },
  { value: 'multi-day', label: '多日' },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isQuoteEditing, setIsQuoteEditing] = useState(false);
  
  // 导出相关 ref
  const costProfitCardRef = useRef<HTMLDivElement>(null);
  const quoteCardRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCostExportMenu, setShowCostExportMenu] = useState(false);
  const [showQuoteExportMenu, setShowQuoteExportMenu] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/');
      return;
    }
    
    const loadData = async () => {
      setIsLoading(true);
      const data = await getProjectData(id);
      if (data) {
        // 迁移旧数据格式
        migrateOldData(data);
        setProjectData(data);
      } else {
        alert('项目不存在或无权限访问');
        router.push('/');
      }
      setIsLoading(false);
    };
    
    loadData();
  }, [id, router, user, authLoading]);

  // 迁移旧数据格式到新格式
  const migrateOldData = (data: ProjectData) => {
    // 迁移工作人员数据
    if (!data.coreConfig.staffMembers && (data.coreConfig as any).staffCounts) {
      const oldStaff = (data.coreConfig as any).staffCounts;
      const oldFees = (data.coreConfig as any).staffDailyFees || {};
      data.coreConfig.staffMembers = [
        { id: 'guide', name: '导游', count: oldStaff.guide || 0, dailyFee: oldFees.guide || 0 },
        { id: 'photographer', name: '摄影', count: oldStaff.photographer || 0, dailyFee: oldFees.photographer || 0 },
        { id: 'videographer', name: '摄像', count: oldStaff.videographer || 0, dailyFee: oldFees.videographer || 0 },
        { id: 'driver', name: '司机', count: oldStaff.driver || 0, dailyFee: oldFees.driver || 0 },
      ];
    }
    
    // 迁移其他费用数据
    if ((data.otherExpenses as any).insurance !== undefined && typeof (data.otherExpenses as any).insurance === 'number') {
      const old = data.otherExpenses as any;
      data.otherExpenses = {
        insurance: { pricePerPerson: 0, days: data.coreConfig.tripDays || 1, totalAmount: old.insurance || 0 },
        serviceFeePercent: 10,
        taxPercent: 1,
        reserveFund: old.reserveFund || 0,
        materials: [],
        otherExpenses: old.other ? [{ id: '1', name: '其他', price: old.other || 0, quantity: 1, totalPrice: old.other || 0 }] : [],
      };
    }
    
    // 迁移交通数据（旧格式 flightEnabled/trainEnabled 转为 otherTransports 数组）
    if (!data.coreConfig.otherTransports) {
      const transports: TransportItem[] = [];
      if ((data.coreConfig as any).flightEnabled && (data.coreConfig as any).flightPrice) {
        transports.push({
          id: 'flight_migrated',
          type: 'flight',
          price: (data.coreConfig as any).flightPrice || 0,
          count: (data.coreConfig as any).flightCount || 0,
        });
      }
      if ((data.coreConfig as any).trainEnabled && (data.coreConfig as any).trainPrice) {
        transports.push({
          id: 'train_migrated',
          type: 'train',
          price: (data.coreConfig as any).trainPrice || 0,
          count: (data.coreConfig as any).trainCount || 0,
        });
      }
      data.coreConfig.otherTransports = transports;
    }
    
    // 迁移每日费用中的staffFees
    data.dailyExpenses?.forEach(day => {
      if (day.staffFees && typeof day.staffFees === 'object') {
        const oldFees = day.staffFees as any;
        if (oldFees.guide !== undefined) {
          day.staffFees = {
            guide: oldFees.guide || 0,
            photographer: oldFees.photographer || 0,
            videographer: oldFees.videographer || 0,
            driver: oldFees.driver || 0,
          };
        }
      }
    });
  };

  const updateData = (updates: Partial<ProjectData>) => {
    if (!projectData) return;
    setProjectData(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  };

  const handleSave = async () => {
    if (!projectData) return;
    setIsSaving(true);
    
    // 调试日志
    console.log('=== 保存数据 ===');
    console.log('staffMembers:', JSON.stringify(projectData.coreConfig.staffMembers));
    console.log('dailyExpenses[0].staffFees:', JSON.stringify(projectData.dailyExpenses[0]?.staffFees));
    
    const success = await updateProjectData(projectData);
    setIsSaving(false);
    if (success) {
      alert('保存成功！');
    } else {
      alert('保存失败，请重试');
    }
  };

  // 导出 Excel
  const handleExportExcel = () => {
    if (!projectData) return;
    const summary = calculateCostSummary(projectData);
    exportToExcel(projectData, summary, dailyExpenses, otherExpenses, coreConfig, discount);
    setShowExportMenu(false);
  };

  // 导出成本利润卡片
  const handleExportCostCard = async (type: 'image' | 'pdf') => {
    if (!costProfitCardRef.current) return;
    const filename = `${projectData?.project.name || '项目'}-成本核算与利润分析`;
    if (type === 'image') {
      await exportElementAsImage(costProfitCardRef.current, filename);
    } else {
      await exportElementAsPDF(costProfitCardRef.current, filename);
    }
    setShowCostExportMenu(false);
  };

  // 导出报价单卡片
  const handleExportQuoteCard = async (type: 'image' | 'pdf') => {
    if (!quoteCardRef.current) return;
    const filename = `${projectData?.project.name || '项目'}-报价单`;
    if (type === 'image') {
      await exportElementAsImage(quoteCardRef.current, filename);
    } else {
      await exportElementAsPDF(quoteCardRef.current, filename);
    }
    setShowQuoteExportMenu(false);
  };

  const handleExport = () => {
    if (!projectData) return;
    const summary = calculateCostSummary(projectData);
    const serviceFee = calculateServiceFee(summary.totalCost, otherExpenses.serviceFeePercent);
    const tax = (summary.totalCost + serviceFee) * (otherExpenses.taxPercent ?? 1) / 100;
    const totalPrice = summary.totalCost + serviceFee + tax;
    const finalPrice = totalPrice - discount;
    
    const projectTypeLabel = projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${coreConfig.tripDays}天`;
    
    const lines = ['═'.repeat(60), '研学旅行报价单', '═'.repeat(60),
      `项目名称：${projectData.project.name}`,
      `行程类型：${projectTypeLabel}`,
      `客户人数：${summary.totalClients}人`,
      `工作人员：${totalStaff}人`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '', '─'.repeat(60), '费用明细', '─'.repeat(60),
    ];
    
    // 住宿费明细
    if (summary.totalAccommodation > 0) {
      lines.push(``, `【住宿费】 ${formatMoney(summary.totalAccommodation)}`);
      if (coreConfig.twinRoom && (coreConfig.twinRoom.countClient > 0 || coreConfig.twinRoom.countStaff > 0)) {
        const totalRooms = (coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0);
        lines.push(`  双床房：${totalRooms}间 × ${coreConfig.twinRoom.price}元/晚 × ${coreConfig.accommodationDays}晚 = ${formatMoney(totalRooms * (coreConfig.twinRoom.price || 0) * coreConfig.accommodationDays)}`);
      }
      if (coreConfig.kingRoom && (coreConfig.kingRoom.countClient > 0 || coreConfig.kingRoom.countStaff > 0)) {
        const totalRooms = (coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0);
        lines.push(`  大床房：${totalRooms}间 × ${coreConfig.kingRoom.price}元/晚 × ${coreConfig.accommodationDays}晚 = ${formatMoney(totalRooms * (coreConfig.kingRoom.price || 0) * coreConfig.accommodationDays)}`);
      }
      if (coreConfig.staffAccommodation) {
        lines.push(`  工作人员住宿：${Math.ceil(totalStaff / 2)}间 × ${coreConfig.staffRoomPrice || 0}元/晚 × ${coreConfig.staffAccommodationNights || 0}晚 = ${formatMoney(Math.ceil(totalStaff / 2) * (coreConfig.staffRoomPrice || 0) * (coreConfig.staffAccommodationNights || 0))}`);
      }
    }
    
    // 用餐费明细
    if (summary.totalMeal > 0) {
      lines.push(``, `【用餐费】 ${formatMoney(summary.totalMeal)}`);
      dailyExpenses.forEach((day) => {
        const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
        const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
        const lunchAmount = lunch.amount || 0;
        const dinnerAmount = dinner.amount || 0;
        if (lunchAmount > 0) {
          const restaurant = lunch.restaurantName ? `(${lunch.restaurantName})` : '';
          lines.push(`  D${day.day}中餐${restaurant}：${formatMoney(lunchAmount)}`);
        }
        if (dinnerAmount > 0) {
          const restaurant = dinner.restaurantName ? `(${dinner.restaurantName})` : '';
          lines.push(`  D${day.day}晚餐${restaurant}：${formatMoney(dinnerAmount)}`);
        }
      });
    }
    
    // 交通费明细
    if (summary.totalBus > 0) {
      lines.push(``, `【交通费】 ${formatMoney(summary.totalBus)}`);
      if (coreConfig.busFee > 0) {
        lines.push(`  大巴租赁：${formatMoney(coreConfig.busFee)}`);
      }
      (coreConfig.otherTransports || []).forEach((t) => {
        const typeName = t.type === 'flight' ? '飞机票' : '高铁票';
        lines.push(`  ${typeName}：${t.count}张 × ${t.price}元/张 = ${formatMoney(t.price * t.count)}`);
      });
    }
    
    // 活动项目明细
    if (summary.totalSingleItems > 0) {
      lines.push(``, `【活动项目】 ${formatMoney(summary.totalSingleItems)}`);
      dailyExpenses.forEach((day) => {
        day.singleItems.filter(item => item.name && (item.totalPrice || item.price * item.count) > 0).forEach((item) => {
          const remark = item.remark ? `（${item.remark}）` : '';
          lines.push(`  D${day.day} ${item.name}：${item.price}元 × ${item.count}${item.unit || '人'}${remark} = ${formatMoney(item.totalPrice || item.price * item.count)}`);
        });
      });
    }
    
    // 工作人员费用明细
    if (summary.totalStaffFee > 0) {
      lines.push(``, `【工作人员】 ${formatMoney(summary.totalStaffFee)}`);
      coreConfig.staffMembers.filter(m => m.count > 0).forEach((member) => {
        // 计算该工作人员的实际总费用（使用每日费用中的实际日薪）
        let actualTotalFee = 0;
        let firstDailyFee = 0;
        dailyExpenses.forEach(day => {
          const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
          if (dailyFee > 0 && firstDailyFee === 0) {
            firstDailyFee = dailyFee;
          }
          actualTotalFee += dailyFee * member.count;
        });
        // 显示的日薪：优先使用找到的第一个有效日薪，否则使用核心配置
        const displayDailyFee = firstDailyFee || member.dailyFee;
        lines.push(`  ${member.name}：${member.count}人 × ${displayDailyFee}元/天 × ${coreConfig.tripDays}天 = ${formatMoney(actualTotalFee)}`);
      });
    }
    
    // 其他费用明细
    if (summary.totalOtherExpenses > 0) {
      lines.push(``, `【其他费用】 ${formatMoney(summary.totalOtherExpenses)}`);
      if (otherExpenses.insurance.totalAmount > 0) {
        lines.push(`  保险费：${otherExpenses.insurance.pricePerPerson}元/人/天 × ${otherExpenses.insurance.days}天 × ${totalClients + totalStaff}人 = ${formatMoney(otherExpenses.insurance.totalAmount)}`);
      }
      if (otherExpenses.reserveFund > 0) {
        lines.push(`  备用金：${formatMoney(otherExpenses.reserveFund)}`);
      }
      otherExpenses.materials.filter(m => m.totalPrice > 0 || m.price * m.quantity > 0).forEach((m) => {
        lines.push(`  杂费(客户)-${m.name}：${m.price}元 × ${m.quantity} = ${formatMoney(m.totalPrice || m.price * m.quantity)}`);
      });
      otherExpenses.otherExpenses.filter(o => o.totalPrice > 0 || o.price * o.quantity > 0).forEach((o) => {
        lines.push(`  杂费(工作人员)-${o.name || '其他'}：${o.price}元 × ${o.quantity} = ${formatMoney(o.totalPrice || o.price * o.quantity)}`);
      });
    }
    
    lines.push('', '─'.repeat(60), 
      `成本小计：${formatMoney(summary.totalCost)}`, 
      `服务费(${otherExpenses.serviceFeePercent}%)：${formatMoney(serviceFee)}`, 
      `税费(${otherExpenses.taxPercent ?? 1}%)：${formatMoney(tax)}`,
      `报价合计：${formatMoney(totalPrice)}`, 
      `优惠：-${formatMoney(discount)}`, 
      '', '═'.repeat(60), 
      `应付金额：${formatMoney(finalPrice)}`, 
      `人均费用：${formatMoney(finalPrice / (summary.totalClients || 1))}`);
    
    // 利润分析（使用报价计算）
    const twinQP = coreConfig.twinRoom?.quotePrice ?? coreConfig.twinRoom?.price ?? 0;
    const kingQP = coreConfig.kingRoom?.quotePrice ?? coreConfig.kingRoom?.price ?? 0;
    const quoteAcc = (coreConfig.twinRoom?.countClient || 0) * twinQP * coreConfig.accommodationDays +
                     (coreConfig.kingRoom?.countClient || 0) * kingQP * coreConfig.accommodationDays;
    
    const quoteMeal = dailyExpenses.reduce((total, day) => {
      const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
      const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
      return total + (lunch.quoteAmount ?? lunch.amount ?? 0) + (dinner.quoteAmount ?? dinner.amount ?? 0);
    }, 0);
    
    const busQ = coreConfig.busQuoteFee ?? coreConfig.busFee ?? 0;
    const transportsQ = (coreConfig.otherTransports || []).reduce((s, t) => s + (t.quotePrice ?? t.price) * t.count, 0);
    const quoteTrans = busQ + transportsQ;
    
    const quoteSingle = dailyExpenses.flatMap(d => d.singleItems).filter(i => i.name).reduce((s, item) => s + (item.quoteTotalPrice || (item.quotePrice || item.price) * item.count), 0);
    const insuranceQ = otherExpenses.insurance.quoteAmount ?? otherExpenses.insurance.totalAmount;
    const materialsQ = otherExpenses.materials.reduce((s, m) => s + (m.quoteTotalPrice ?? m.totalPrice ?? m.price * m.quantity), 0);
    const quoteOther = insuranceQ + materialsQ;
    
    const qSubtotal = quoteAcc + quoteMeal + quoteTrans + quoteSingle + quoteOther;
    const qServiceFee = calculateServiceFee(qSubtotal, otherExpenses.serviceFeePercent);
    const qTax = (qSubtotal + qServiceFee) * (otherExpenses.taxPercent ?? 1) / 100;
    const qTotal = qSubtotal + qServiceFee + qTax;
    const revenue = qTotal - discount;
    const cost = summary.totalCost;
    const profit = revenue - cost;
    const profitRate = revenue > 0 ? (profit / revenue * 100) : 0;
    
    lines.push('', '─'.repeat(60), '利润分析（内部参考）', '─'.repeat(60),
      `营收：${formatMoney(revenue)}`,
      `成本：${formatMoney(cost)}`,
      `利润：${profit >= 0 ? '+' : ''}${formatMoney(profit)}`,
      `利润率：${profitRate.toFixed(1)}%`);
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.project.name}-报价单.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  );
  
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LogIn className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">请先登录</p>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </div>
    </div>
  );
  
  if (!projectData) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">项目不存在或无权限访问</p>
        <Button onClick={() => router.push('/')}>返回首页</Button>
      </div>
    </div>
  );

  const { coreConfig, dailyExpenses, otherExpenses } = projectData;
  const summary = calculateCostSummary(projectData);
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = coreConfig.staffMembers.reduce((sum, m) => sum + m.count, 0);
  const totalPeople = totalClients + totalStaff;

  // 确保工作人员列表存在
  if (!coreConfig.staffMembers || coreConfig.staffMembers.length === 0) {
    coreConfig.staffMembers = [...DEFAULT_STAFF_MEMBERS];
  }
  
  // 同步工作人员日薪：如果核心配置中的日薪为0，清除每日费用中对应的历史值
  coreConfig.staffMembers.forEach(member => {
    if (member.dailyFee === 0) {
      dailyExpenses.forEach(day => {
        if (day.staffFees && day.staffFees[member.id] !== undefined && day.staffFees[member.id] !== 0) {
          delete day.staffFees[member.id];
        }
      });
    }
  });
  
  // 确保其他费用格式正确
  if (!otherExpenses.insurance || typeof otherExpenses.insurance !== 'object') {
    otherExpenses.insurance = { ...DEFAULT_INSURANCE_CONFIG, days: coreConfig.tripDays };
  }
  if (!otherExpenses.materials) otherExpenses.materials = [];
  if (!otherExpenses.otherExpenses) otherExpenses.otherExpenses = [];
  if (otherExpenses.taxPercent === undefined || otherExpenses.taxPercent === null) {
    otherExpenses.taxPercent = 1;
  }
  // 迁移旧的 otherExpenses 格式（remark/amount -> name/price/quantity/totalPrice）
  otherExpenses.otherExpenses = otherExpenses.otherExpenses.map((item: any) => {
    if (item.remark !== undefined && item.amount !== undefined) {
      return {
        id: item.id,
        name: item.remark || '',
        price: item.amount || 0,
        quantity: 1,
        totalPrice: item.amount || 0
      };
    }
    return item;
  });

  // 确保每日数据长度正确，且每天至少有一个活动项目
  if (dailyExpenses.length !== coreConfig.tripDays) {
    const staffFeesBase: Record<string, number> = {};
    coreConfig.staffMembers.forEach(m => { staffFeesBase[m.id] = m.dailyFee; });
    
    const newData = Array.from({ length: coreConfig.tripDays }, (_, i) => {
      const existingDay = dailyExpenses[i];
      if (existingDay) {
        // 如果已有数据但没有活动项目，添加一个默认的
        if (!existingDay.singleItems || existingDay.singleItems.length === 0) {
          return {
            ...existingDay,
            singleItems: [{ id: Date.now().toString() + i, name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClients, unit: '人' as const, totalPrice: 0 }]
          };
        }
        // 确保 unit 字段存在
        if (existingDay.singleItems.some(item => !item.unit)) {
          return {
            ...existingDay,
            singleItems: existingDay.singleItems.map(item => ({ ...item, unit: item.unit || '人' as const }))
          };
        }
        return existingDay;
      }
      // 新创建的天，默认添加一个活动项目
      return { 
        day: i + 1, 
        accommodation: 0, 
        lunch: { ...DEFAULT_MEAL_CONFIG }, 
        dinner: { ...DEFAULT_MEAL_CONFIG },
        staffFees: { ...staffFeesBase }, 
        singleItems: [{ id: Date.now().toString() + i, name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClients, unit: '人' as const, totalPrice: 0 }] 
      };
    });
    updateData({ dailyExpenses: newData });
  } else {
    // 即使天数正确，也要确保每天至少有一个活动项目
    let needsUpdate = false;
    const updatedDays = dailyExpenses.map((day, idx) => {
      if (!day.singleItems || day.singleItems.length === 0) {
        needsUpdate = true;
        return {
          ...day,
          singleItems: [{ id: Date.now().toString() + idx, name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClients, unit: '人' as const, totalPrice: 0 }]
        };
      }
      // 确保 unit 字段存在
      if (day.singleItems.some(item => !item.unit)) {
        needsUpdate = true;
        return {
          ...day,
          singleItems: day.singleItems.map(item => ({ ...item, unit: item.unit || '人' as const }))
        };
      }
      return day;
    });
    if (needsUpdate) {
      updateData({ dailyExpenses: updatedDays });
    }
  }

  // 添加工作人员
  const addStaffMember = () => {
    const newId = `staff_${Date.now()}`;
    updateData({
      coreConfig: {
        ...coreConfig,
        staffMembers: [...coreConfig.staffMembers, { id: newId, name: '', count: 0, dailyFee: 0 }]
      }
    });
  };

  // 更新工作人员
  const updateStaffMember = (id: string, updates: Partial<StaffMember>) => {
    console.log('=== updateStaffMember ===');
    console.log('id:', id, 'updates:', updates);
    
    setProjectData(prev => {
      if (!prev) return prev;
      
      console.log('prev staffMembers:', prev.coreConfig.staffMembers.map(m => ({ id: m.id, name: m.name, count: m.count, dailyFee: m.dailyFee })));
      
      const newMembers = prev.coreConfig.staffMembers.map(m => 
        m.id === id ? { ...m, ...updates } : m
      );
      
      console.log('new staffMembers:', newMembers.map(m => ({ id: m.id, name: m.name, count: m.count, dailyFee: m.dailyFee })));
      
      const newCoreConfig = { ...prev.coreConfig, staffMembers: newMembers };
      
      // 同步更新每日费用中的日薪
      let newDailyExpenses = prev.dailyExpenses;
      if (updates.dailyFee !== undefined) {
        if (updates.dailyFee === 0) {
          newDailyExpenses = prev.dailyExpenses.map(day => {
            const newStaffFees: Record<string, number> = {};
            Object.entries(day.staffFees || {}).forEach(([key, value]) => {
              if (key !== id) {
                newStaffFees[key] = value;
              }
            });
            return { ...day, staffFees: newStaffFees };
          });
        } else {
          newDailyExpenses = prev.dailyExpenses.map(day => ({
            ...day,
            staffFees: { ...(day.staffFees || {}), [id]: updates.dailyFee! } as Record<string, number>
          }));
        }
      }
      
      console.log('newDailyExpenses[0].staffFees:', newDailyExpenses[0]?.staffFees);
      
      return { 
        ...prev,
        coreConfig: newCoreConfig, 
        dailyExpenses: newDailyExpenses 
      };
    });
  };

  // 删除工作人员
  const removeStaffMember = (id: string) => {
    updateData({
      coreConfig: { ...coreConfig, staffMembers: coreConfig.staffMembers.filter(m => m.id !== id) }
    });
  };

  // 添加交通方式（飞机/高铁）
  const addTransport = (type: 'flight' | 'train') => {
    const newId = `transport_${Date.now()}`;
    const currentTransports = coreConfig.otherTransports || [];
    updateData({
      coreConfig: {
        ...coreConfig,
        otherTransports: [...currentTransports, { id: newId, type, price: 0, count: totalClients + totalStaff }]
      }
    });
  };

  // 更新交通方式
  const updateTransport = (id: string, updates: { price?: number; count?: number }) => {
    const newTransports = (coreConfig.otherTransports || []).map(t => 
      t.id === id ? { ...t, ...updates } : t
    );
    updateData({ coreConfig: { ...coreConfig, otherTransports: newTransports } });
  };

  // 删除交通方式
  const removeTransport = (id: string) => {
    updateData({
      coreConfig: { ...coreConfig, otherTransports: (coreConfig.otherTransports || []).filter(t => t.id !== id) }
    });
  };

  // 更新保险费用
  const updateInsurance = (updates: Partial<typeof otherExpenses.insurance>) => {
    const newInsurance = { ...otherExpenses.insurance, ...updates };
    // 自动计算总价（包含客户和工作人员）
    if ('pricePerPerson' in updates || 'days' in updates) {
      newInsurance.totalAmount = newInsurance.pricePerPerson * newInsurance.days * (totalClients + totalStaff);
    }
    updateData({ otherExpenses: { ...otherExpenses, insurance: newInsurance } });
  };

  // 添加物料
  const addMaterial = () => {
    updateData({
      otherExpenses: {
        ...otherExpenses,
        materials: [...otherExpenses.materials, { id: `mat_${Date.now()}`, name: '', price: 0, quantity: 0, totalPrice: 0 }]
      }
    });
  };

  // 更新物料
  const updateMaterial = (id: string, updates: Partial<MaterialItem>) => {
    const newMaterials = otherExpenses.materials.map(m => {
      if (m.id === id) {
        const updated = { ...m, ...updates };
        if ('price' in updates || 'quantity' in updates) {
          updated.totalPrice = updated.price * updated.quantity;
        }
        return updated;
      }
      return m;
    });
    updateData({ otherExpenses: { ...otherExpenses, materials: newMaterials } });
  };

  // 删除物料
  const removeMaterial = (id: string) => {
    updateData({
      otherExpenses: { ...otherExpenses, materials: otherExpenses.materials.filter(m => m.id !== id) }
    });
  };

  // 添加其他费用
  const addOtherExpense = () => {
    updateData({
      otherExpenses: {
        ...otherExpenses,
        otherExpenses: [...otherExpenses.otherExpenses, { id: `other_${Date.now()}`, name: '', price: 0, quantity: 1, totalPrice: 0 }]
      }
    });
  };

  // 更新其他费用
  const updateOtherExpense = (id: string, updates: Partial<OtherExpenseItem>) => {
    const newOthers = otherExpenses.otherExpenses.map(o => {
      if (o.id === id) {
        const updated = { ...o, ...updates };
        // 自动计算总价
        if (updates.price !== undefined || updates.quantity !== undefined) {
          updated.totalPrice = updated.price * updated.quantity;
        }
        return updated;
      }
      return o;
    });
    updateData({ otherExpenses: { ...otherExpenses, otherExpenses: newOthers } });
  };

  // 删除其他费用
  const removeOtherExpense = (id: string) => {
    updateData({
      otherExpenses: { ...otherExpenses, otherExpenses: otherExpenses.otherExpenses.filter(o => o.id !== id) }
    });
  };

  const serviceFee = calculateServiceFee(summary.totalCost, otherExpenses.serviceFeePercent);
  const tax = (summary.totalCost + serviceFee) * (otherExpenses.taxPercent ?? 1) / 100;
  const totalPrice = summary.totalCost + serviceFee + tax;
  const finalPrice = totalPrice - discount;
  const pricePerClient = totalClients > 0 ? finalPrice / totalClients : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Input value={projectData.project.name} onChange={(e) => updateData({ project: { ...projectData.project, name: e.target.value } })}
                className="text-xl font-bold text-gray-900 border-0 p-0 h-auto w-auto min-w-32 max-w-64 focus-visible:ring-0" />
              <span className="text-sm text-gray-500">
                时长类型：<span className={`font-medium ${
                  projectData.project.type === 'half-day' ? 'text-green-600' :
                  projectData.project.type === 'one-day' ? 'text-blue-600' :
                  'text-purple-600'
                }`}>{PROJECT_TYPES.find(t => t.value === projectData.project.type)?.label}</span>
              </span>
            </div>
            <div className="flex gap-2">
              {/* 导出按钮 */}
              <div className="relative">
                <Button variant="outline" size="sm" className="h-8 text-sm" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download className="w-4 h-4 mr-1" />导出
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 top-10 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[140px]">
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      onClick={handleExportExcel}
                    >
                      <FileSpreadsheet className="w-4 h-4" />导出 Excel
                    </button>
                    <button
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      onClick={() => { handleExport(); setShowExportMenu(false); }}
                    >
                      <FileText className="w-4 h-4" />导出文本
                    </button>
                  </div>
                )}
              </div>
              <Button size="sm" className="h-8 text-sm" onClick={handleSave} disabled={isSaving}><Save className="w-4 h-4 mr-1" />{isSaving ? '保存中' : '保存'}</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-4">
          {/* 项目时长 - 仅多日项目显示 */}
          {projectData.project.type === 'multi-day' && (
            <Card>
              <CardContent className="py-2.5 px-4">
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-500 font-medium">项目时长</span>
                  <div className="flex items-center gap-1.5">
                    <NumberInput className="h-7 w-14 text-sm px-2 border rounded" value={coreConfig.tripDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, tripDays: v, accommodationDays: v > 0 ? Math.min(coreConfig.accommodationDays, v) : 0 } })} />
                    <span className="text-gray-600">天</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <NumberInput className="h-7 w-14 text-sm px-2 border rounded" value={coreConfig.accommodationDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, accommodationDays: v } })} />
                    <span className="text-gray-600">晚住宿</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 客户配置 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50"><CardTitle className="text-lg font-bold text-gray-800">客户配置 <span className="text-blue-600 font-normal text-sm">共{totalClients}人</span></CardTitle></CardHeader>
            <CardContent className="py-3 px-4 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500 w-12">人员</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">学生</span>
                  <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.studentCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, studentCount: v } })} />
                  <span className="text-gray-500">人</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">老师</span>
                  <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.teacherCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, teacherCount: v } })} />
                  <span className="text-gray-500">人</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">家长</span>
                  <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.parentCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, parentCount: v } })} />
                  <span className="text-gray-500">人</span>
                </div>
              </div>

              {projectData.project.type === 'multi-day' && (
                <>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-500 w-12">住宿</span>
                    <span className="text-gray-600">标准</span>
                    <div className="flex gap-3">
                      {(Object.keys(ACCOMMODATION_TYPE_LABELS) as AccommodationType[]).map(type => (
                        <label key={type} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="accommodationType"
                            checked={(coreConfig.accommodationType || '3-diamond') === type}
                            onChange={() => updateData({ coreConfig: { ...coreConfig, accommodationType: type } })}
                            className="w-4 h-4 accent-blue-500"
                          />
                          <span className={`${(coreConfig.accommodationType || '3-diamond') === type ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{ACCOMMODATION_TYPE_LABELS[type]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 w-12">双床房</span>
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.twinRoom?.countClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, twinRoom: { ...coreConfig.twinRoom, countClient: v, price: coreConfig.twinRoom?.price || 0, countStaff: coreConfig.twinRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500">间</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.twinRoom?.price || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, twinRoom: { ...coreConfig.twinRoom, price: v, countClient: coreConfig.twinRoom?.countClient || 0, countStaff: coreConfig.twinRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500 whitespace-nowrap">元/间</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600 w-12">大床房</span>
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.kingRoom?.countClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, kingRoom: { ...coreConfig.kingRoom, countClient: v, price: coreConfig.kingRoom?.price || 0, countStaff: coreConfig.kingRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500">间</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.kingRoom?.price || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, kingRoom: { ...coreConfig.kingRoom, price: v, countClient: coreConfig.kingRoom?.countClient || 0, countStaff: coreConfig.kingRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-500 whitespace-nowrap">元/间</span>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500 w-12">用餐</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">餐标</span>
                  <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.mealStandardClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardClient: v } })} />
                  <span className="text-gray-500 whitespace-nowrap">元/人</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 人员及大交通 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50">
              <CardTitle className="text-lg font-bold text-gray-800">人员及大交通 <span className="text-green-600 font-normal text-sm">共{totalStaff}人</span></CardTitle>
            </CardHeader>
            <CardContent className="py-3 px-4 space-y-2">
              {coreConfig.staffMembers.map((member, index) => (
                <div key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm bg-gray-50 rounded-lg p-2">
                  <Input 
                    placeholder="角色名称" 
                    className="h-8 w-24 text-sm px-2" 
                    value={member.name} 
                    onChange={(e) => updateStaffMember(member.id, { name: e.target.value })} 
                  />
                  <div className="flex items-center gap-1">
                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={member.count} onChange={(v) => updateStaffMember(member.id, { count: v })} />
                    <span className="text-gray-500">人</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">日薪</span>
                    <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={member.dailyFee} onChange={(v) => updateStaffMember(member.id, { dailyFee: v })} />
                    <span className="text-gray-500">元</span>
                  </div>
                  {coreConfig.staffMembers.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeStaffMember(member.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="h-7 text-sm mt-1" onClick={addStaffMember}><Plus className="w-4 h-4 mr-1" />添加角色</Button>
              
              {projectData.project.type === 'multi-day' && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span className="text-gray-500 w-12">住宿</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="staffAccommodation" checked={coreConfig.staffAccommodation === true} onChange={() => updateData({ coreConfig: { ...coreConfig, staffAccommodation: true } })} className="w-4 h-4 accent-blue-500" />
                        <span>是</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="staffAccommodation" checked={coreConfig.staffAccommodation === false} onChange={() => updateData({ coreConfig: { ...coreConfig, staffAccommodation: false } })} className="w-4 h-4 accent-blue-500" />
                        <span>否</span>
                      </label>
                    </div>
                    {coreConfig.staffAccommodation && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pl-16">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600">床型</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="staffRoomType" checked={(coreConfig.staffRoomType || 'twin') === 'twin'} onChange={() => updateData({ coreConfig: { ...coreConfig, staffRoomType: 'twin' } })} className="w-4 h-4 accent-blue-500" />
                            <span>双床</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="staffRoomType" checked={coreConfig.staffRoomType === 'king'} onChange={() => updateData({ coreConfig: { ...coreConfig, staffRoomType: 'king' } })} className="w-4 h-4 accent-blue-500" />
                            <span>大床</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-1">
                          <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={coreConfig.staffRoomPrice || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffRoomPrice: v } })} />
                          <span className="text-gray-500 whitespace-nowrap">元/间</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.staffAccommodationNights || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffAccommodationNights: v } })} />
                          <span className="text-gray-500">晚</span>
                        </div>
                        <span className="text-gray-400 text-sm">({Math.ceil(totalStaff / 2)}间)</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator className="my-3" />
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">大交通</span>
                
                {/* 大巴 - 默认显示 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-600 w-12">大巴</span>
                  <div className="flex items-center gap-1">
                    <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={coreConfig.busFee} onChange={(v) => updateData({ coreConfig: { ...coreConfig, busFee: v } })} />
                    <span className="text-gray-500">元</span>
                  </div>
                </div>
                
                {/* 已添加的交通方式 */}
                {(coreConfig.otherTransports || []).map((transport) => (
                  <div key={transport.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm bg-gray-50 rounded-lg p-2">
                    <span className="text-gray-700 w-12">{transport.type === 'flight' ? '飞机' : '高铁'}</span>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={transport.price} onChange={(v) => updateTransport(transport.id, { price: v })} />
                      <span className="text-gray-500 whitespace-nowrap">元/张</span>
                    </div>
                    <span className="text-gray-400">×</span>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={transport.count} onChange={(v) => updateTransport(transport.id, { count: v })} />
                      <span className="text-gray-500">张</span>
                    </div>
                    <span className="text-gray-400">=</span>
                    <span className="font-medium">{formatMoney(transport.price * transport.count)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeTransport(transport.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                {/* 添加按钮 */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={() => addTransport('flight')}>
                    <Plus className="w-4 h-4 mr-1" />添加飞机
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={() => addTransport('train')}>
                    <Plus className="w-4 h-4 mr-1" />添加高铁
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 每日费用 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50"><CardTitle className="text-lg font-bold text-gray-800">{projectData.project.type === 'half-day' ? '费用明细' : '每日费用'}</CardTitle></CardHeader>
            <CardContent className="py-3 px-4 space-y-4">
              {coreConfig.tripDays === 0 && projectData.project.type === 'multi-day' ? (
                <div className="text-center text-gray-400 text-sm py-4">请先设置行程天数</div>
              ) : (
                dailyExpenses.slice(0, Math.max(1, coreConfig.tripDays)).map((day, dayIdx) => {
                  // 计算住宿费用
                  const calculatedAccommodation = (projectData.project.type === 'multi-day' && dayIdx < coreConfig.accommodationDays)
                    ? (coreConfig.twinRoom?.price || 0) * ((coreConfig.twinRoom?.countClient || 0) + (coreConfig.twinRoom?.countStaff || 0)) +
                      (coreConfig.kingRoom?.price || 0) * ((coreConfig.kingRoom?.countClient || 0) + (coreConfig.kingRoom?.countStaff || 0))
                    : 0;
                  
                  // 计算单餐费用
                  const calculateMealAmount = (mealConfig: typeof day.lunch) => {
                    if (mealConfig.amount && mealConfig.amount > 0) return mealConfig.amount;
                    const pricePerPerson = mealConfig.pricePerPerson || coreConfig.mealStandardClient || 0;
                    const clientMealType = mealConfig.clientMealType || 'individual';
                    const clientAmount = clientMealType === 'table'
                      ? pricePerPerson * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
                      : pricePerPerson * (mealConfig.clientCount || totalClients);
                    const staffAmount = mealConfig.staffMealType === 'independent'
                      ? (coreConfig.mealStandardStaff || 0) * totalStaff
                      : 0;
                    return clientAmount + staffAmount;
                  };
                  
                  const lunch = day.lunch || { ...DEFAULT_MEAL_CONFIG };
                  const dinner = day.dinner || { ...DEFAULT_MEAL_CONFIG };
                  const lunchAmount = lunch.amount || calculateMealAmount(lunch);
                  const dinnerAmount = dinner.amount || calculateMealAmount(dinner);
                  const accommodationValue = day.accommodation || calculatedAccommodation;
                  
                  // 计算工作人员费用
                  let dayStaffFee = 0;
                  coreConfig.staffMembers.forEach(member => {
                    const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
                    dayStaffFee += dailyFee * member.count;
                  });
                  
                  const daySingleItems = day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0);
                  const dayTotal = accommodationValue + lunchAmount + dinnerAmount + dayStaffFee + daySingleItems;
                  
                  const updateMeal = (mealType: 'lunch' | 'dinner', updates: Partial<typeof day.lunch>) => {
                    const newDays = [...dailyExpenses];
                    newDays[dayIdx] = { ...day, [mealType]: { ...day[mealType], ...updates } };
                    updateData({ dailyExpenses: newDays });
                  };
                  
                  return (
                    <div key={day.day} className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="text-lg font-bold text-gray-900">{projectData.project.type === 'half-day' ? '费用明细' : `第${day.day}天`}</span>
                        <span className="text-lg font-bold text-gray-900">¥{dayTotal.toFixed(0)}</span>
                      </div>
                      
                      {/* 住宿和工作人员薪资 */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        {projectData.project.type === 'multi-day' && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 w-12">住宿</span>
                            <NumberInput 
                              className="h-8 w-24 text-sm px-2 border rounded" 
                              value={accommodationValue} 
                              onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, accommodation: v }; updateData({ dailyExpenses: newDays }); }} 
                            />
                            <span className="text-gray-500">元</span>
                          </div>
                        )}
                        {coreConfig.staffMembers.filter(m => m.count > 0).map(member => (
                          <div key={member.id} className="flex items-center gap-2">
                            <span className="text-gray-600">{member.name}</span>
                            <NumberInput 
                              className="h-8 w-20 text-sm px-2 border rounded" 
                              value={day.staffFees[member.id] ?? member.dailyFee} 
                              onChange={(v) => { 
                                const newDays = [...dailyExpenses]; 
                                newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, [member.id]: v } }; 
                                updateData({ dailyExpenses: newDays }); 
                              }} 
                            />
                            <span className="text-gray-500">元</span>
                          </div>
                        ))}
                      </div>

                      {/* 活动项目 */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 font-medium">活动项目</span>
                          <Button variant="outline" size="sm" className="h-7 text-sm px-3" onClick={() => { 
                            const newDays = [...dailyExpenses]; 
                            newDays[dayIdx] = { ...day, singleItems: [...day.singleItems, { id: Date.now().toString(), name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClients, unit: '人' as const, totalPrice: 0 }] }; 
                            updateData({ dailyExpenses: newDays }); 
                          }}><Plus className="w-4 h-4 mr-1" />添加</Button>
                        </div>
                        {day.singleItems.map((item, itemIdx) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-3">
                              <Input placeholder="项目名称" className="h-8 flex-1 text-sm px-3" value={item.name} onChange={(e) => { 
                                const newDays = [...dailyExpenses]; 
                                const items = [...day.singleItems]; 
                                items[itemIdx] = { ...items[itemIdx], name: e.target.value }; 
                                newDays[dayIdx] = { ...day, singleItems: items }; 
                                updateData({ dailyExpenses: newDays }); 
                              }} />
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => { 
                                const newDays = [...dailyExpenses]; 
                                newDays[dayIdx] = { ...day, singleItems: day.singleItems.filter((_, i) => i !== itemIdx) }; 
                                updateData({ dailyExpenses: newDays }); 
                              }}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            <textarea 
                              placeholder="备注说明" 
                              className="w-full h-16 text-sm px-3 py-2 border rounded resize-none" 
                              value={item.remark || ''} 
                              onChange={(e) => { 
                                const newDays = [...dailyExpenses]; 
                                const items = [...day.singleItems]; 
                                items[itemIdx] = { ...items[itemIdx], remark: e.target.value }; 
                                newDays[dayIdx] = { ...day, singleItems: items }; 
                                updateData({ dailyExpenses: newDays }); 
                              }} 
                            />
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">单价</span>
                              <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={item.price} onChange={(v) => { 
                                const newDays = [...dailyExpenses]; 
                                const items = [...day.singleItems]; 
                                items[itemIdx] = { ...items[itemIdx], price: v, totalPrice: v * items[itemIdx].count }; 
                                newDays[dayIdx] = { ...day, singleItems: items }; 
                                updateData({ dailyExpenses: newDays }); 
                              }} />
                              <span className="text-gray-500 whitespace-nowrap">元 ×</span>
                              <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={item.count} onChange={(v) => { 
                                const newDays = [...dailyExpenses]; 
                                const items = [...day.singleItems]; 
                                items[itemIdx] = { ...items[itemIdx], count: v || totalClients, totalPrice: items[itemIdx].price * (v || totalClients) }; 
                                newDays[dayIdx] = { ...day, singleItems: items }; 
                                updateData({ dailyExpenses: newDays }); 
                              }} />
                              <select 
                                className="h-8 text-sm px-2 border rounded bg-white"
                                value={item.unit || '人'}
                                onChange={(e) => {
                                  const newDays = [...dailyExpenses];
                                  const items = [...day.singleItems];
                                  items[itemIdx] = { ...items[itemIdx], unit: e.target.value as '人' | '团' | '组' | '辆' | '间' };
                                  newDays[dayIdx] = { ...day, singleItems: items };
                                  updateData({ dailyExpenses: newDays });
                                }}
                              >
                                <option value="人">人</option>
                                <option value="团">团</option>
                                <option value="组">组</option>
                                <option value="辆">辆</option>
                                <option value="间">间</option>
                              </select>
                              <span className="text-gray-500">=</span>
                              <span className="text-base font-semibold text-gray-900">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 中餐 - 餐厅名优先 */}
                      <div className={`bg-gray-50 rounded-lg p-3 space-y-2 ${lunch.enabled === false ? 'opacity-50' : ''}`}>
                        <div className="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 font-medium">中餐</span>
                            <button
                              type="button"
                              onClick={() => updateMeal('lunch', { enabled: lunch.enabled === false ? true : false })}
                              className={`text-xs px-2 py-0.5 rounded ${lunch.enabled === false ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}
                            >
                              {lunch.enabled === false ? '启用' : '删除'}
                            </button>
                          </div>
                          {lunch.enabled !== false && (
                            <>
                              <Input placeholder="餐厅名称（可选）" className="h-8 text-sm px-3" value={lunch.restaurantName || ''} onChange={(e) => updateMeal('lunch', { restaurantName: e.target.value })} />
                              <span></span>
                            </>
                          )}
                        </div>
                        {lunch.enabled !== false && (
                          <>
                            <div className="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 items-center text-sm">
                              <span className="text-gray-500">客户</span>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`lunch-client-${day.day}`} checked={lunch.clientMealType === 'individual'} onChange={() => updateMeal('lunch', { clientMealType: 'individual', tableCount: 0, clientCount: lunch.clientCount || totalClients, pricePerPerson: lunch.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                                  <span>例餐</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`lunch-client-${day.day}`} checked={(lunch.clientMealType || 'table') === 'table'} onChange={() => updateMeal('lunch', { clientMealType: 'table', tableCount: lunch.tableCount || Math.ceil(totalClients / 10), clientCount: 0, pricePerPerson: lunch.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                                  <span>桌餐</span>
                                </label>
                                <div className="flex items-center gap-1">
                                  <NumberInput 
                                    className="h-8 w-16 text-sm px-2 border rounded" 
                                    value={(lunch.clientMealType || 'table') === 'table' 
                                      ? (lunch.pricePerPerson || coreConfig.mealStandardClient || 0) * 10 
                                      : (lunch.pricePerPerson || coreConfig.mealStandardClient || 0)} 
                                    onChange={(v) => updateMeal('lunch', { pricePerPerson: (lunch.clientMealType || 'table') === 'table' ? v / 10 : v })} 
                                  />
                                  <span className="text-gray-500 whitespace-nowrap">{(lunch.clientMealType || 'table') === 'table' ? '元/桌' : '元/人'}</span>
                                </div>
                                <span className="text-gray-400">×</span>
                                {lunch.clientMealType === 'individual' ? (
                                  <div className="flex items-center gap-1">
                                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={lunch.clientCount || totalClients} onChange={(v) => updateMeal('lunch', { clientCount: v })} />
                                    <span className="text-gray-500">人</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={lunch.tableCount || Math.ceil(totalClients / 10)} onChange={(v) => updateMeal('lunch', { tableCount: v })} />
                                    <span className="text-gray-500">桌</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400">¥</span>
                                <NumberInput className="h-8 w-24 text-sm px-2 border rounded text-right" value={lunchAmount} onChange={(v) => updateMeal('lunch', { amount: v })} />
                              </div>
                              <span className="text-gray-500">工作人员</span>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`lunch-staff-${day.day}`} checked={(lunch.staffMealType || 'with-group') === 'with-group'} onChange={() => updateMeal('lunch', { staffMealType: 'with-group' })} className="w-4 h-4" />
                                  <span>随团</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`lunch-staff-${day.day}`} checked={lunch.staffMealType === 'independent'} onChange={() => updateMeal('lunch', { staffMealType: 'independent' })} className="w-4 h-4" />
                                  <span>独立</span>
                                </label>
                                {lunch.staffMealType === 'independent' && (
                                  <div className="flex items-center gap-1">
                                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} />
                                    <span className="text-gray-500 whitespace-nowrap">元/人</span>
                                  </div>
                                )}
                              </div>
                              <span></span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* 晚餐 - 餐厅名优先 */}
                      <div className={`bg-gray-50 rounded-lg p-3 space-y-2 ${dinner.enabled === false ? 'opacity-50' : ''}`}>
                        <div className="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 font-medium">晚餐</span>
                            <button
                              type="button"
                              onClick={() => updateMeal('dinner', { enabled: dinner.enabled === false ? true : false })}
                              className={`text-xs px-2 py-0.5 rounded ${dinner.enabled === false ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}
                            >
                              {dinner.enabled === false ? '启用' : '删除'}
                            </button>
                          </div>
                          {dinner.enabled !== false && (
                            <>
                              <Input placeholder="餐厅名称（可选）" className="h-8 text-sm px-3" value={dinner.restaurantName || ''} onChange={(e) => updateMeal('dinner', { restaurantName: e.target.value })} />
                              <span></span>
                            </>
                          )}
                        </div>
                        {dinner.enabled !== false && (
                          <>
                            <div className="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 items-center text-sm">
                              <span className="text-gray-500">客户</span>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`dinner-client-${day.day}`} checked={dinner.clientMealType === 'individual'} onChange={() => updateMeal('dinner', { clientMealType: 'individual', tableCount: 0, clientCount: dinner.clientCount || totalClients, pricePerPerson: dinner.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                                  <span>例餐</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`dinner-client-${day.day}`} checked={(dinner.clientMealType || 'table') === 'table'} onChange={() => updateMeal('dinner', { clientMealType: 'table', tableCount: dinner.tableCount || Math.ceil(totalClients / 10), clientCount: 0, pricePerPerson: dinner.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                                  <span>桌餐</span>
                                </label>
                                <div className="flex items-center gap-1">
                                  <NumberInput 
                                    className="h-8 w-16 text-sm px-2 border rounded" 
                                    value={(dinner.clientMealType || 'table') === 'table' 
                                      ? (dinner.pricePerPerson || coreConfig.mealStandardClient || 0) * 10 
                                      : (dinner.pricePerPerson || coreConfig.mealStandardClient || 0)} 
                                    onChange={(v) => updateMeal('dinner', { pricePerPerson: (dinner.clientMealType || 'table') === 'table' ? v / 10 : v })} 
                                  />
                                  <span className="text-gray-500 whitespace-nowrap">{(dinner.clientMealType || 'table') === 'table' ? '元/桌' : '元/人'}</span>
                                </div>
                                <span className="text-gray-400">×</span>
                                {dinner.clientMealType === 'individual' ? (
                                  <div className="flex items-center gap-1">
                                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={dinner.clientCount || totalClients} onChange={(v) => updateMeal('dinner', { clientCount: v })} />
                                    <span className="text-gray-500">人</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={dinner.tableCount || Math.ceil(totalClients / 10)} onChange={(v) => updateMeal('dinner', { tableCount: v })} />
                                    <span className="text-gray-500">桌</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400">¥</span>
                                <NumberInput className="h-8 w-24 text-sm px-2 border rounded text-right" value={dinnerAmount} onChange={(v) => updateMeal('dinner', { amount: v })} />
                              </div>
                              <span className="text-gray-500">工作人员</span>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`dinner-staff-${day.day}`} checked={(dinner.staffMealType || 'with-group') === 'with-group'} onChange={() => updateMeal('dinner', { staffMealType: 'with-group' })} className="w-4 h-4" />
                                  <span>随团</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`dinner-staff-${day.day}`} checked={dinner.staffMealType === 'independent'} onChange={() => updateMeal('dinner', { staffMealType: 'independent' })} className="w-4 h-4" />
                                  <span>独立</span>
                                </label>
                                {dinner.staffMealType === 'independent' && (
                                  <div className="flex items-center gap-1">
                                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} />
                                    <span className="text-gray-500 whitespace-nowrap">元/人</span>
                                  </div>
                                )}
                              </div>
                              <span></span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* 其他费用 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50"><CardTitle className="text-lg font-bold text-gray-800">其他费用</CardTitle></CardHeader>
            <CardContent className="py-3 px-4 space-y-4">
              {/* 保险费 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">保险费</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1">
                    <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={otherExpenses.insurance.pricePerPerson} onChange={(v) => updateInsurance({ pricePerPerson: v })} />
                    <span className="text-gray-500 whitespace-nowrap">元/人/天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">×</span>
                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={otherExpenses.insurance.days} onChange={(v) => updateInsurance({ days: v })} />
                    <span className="text-gray-500">天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">×</span>
                    <span className="text-gray-500">{totalClients + totalStaff}人</span>
                    <span className="text-gray-400 text-xs">(客户{totalClients}+工作人员{totalStaff})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">=</span>
                    <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={otherExpenses.insurance.totalAmount} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, insurance: { ...otherExpenses.insurance, totalAmount: v } } })} />
                    <span className="text-gray-500">元</span>
                  </div>
                </div>
              </div>

              {/* 服务费 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">服务费</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">按成本</span>
                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={otherExpenses.serviceFeePercent} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, serviceFeePercent: v } })} />
                    <span className="text-gray-500">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">=</span>
                    <span className="text-base font-semibold text-gray-900">{formatMoney(serviceFee)}</span>
                  </div>
                </div>
              </div>

              {/* 税费 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">税费</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">按合计</span>
                    <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={otherExpenses.taxPercent ?? 1} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, taxPercent: v } })} />
                    <span className="text-gray-500">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">=</span>
                    <span className="text-base font-semibold text-gray-900">{formatMoney(tax)}</span>
                  </div>
                </div>
              </div>

              {/* 备用金 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium text-gray-700">备用金</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1">
                    <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={otherExpenses.reserveFund} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, reserveFund: v } })} />
                    <span className="text-gray-500">元</span>
                  </div>
                </div>
              </div>

              {/* 杂费（客户） */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">杂费（客户）</span>
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={addMaterial}><Plus className="w-4 h-4 mr-1" />添加</Button>
                </div>
                {otherExpenses.materials.map((material) => (
                  <div key={material.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <Input placeholder="项目名称" className="h-8 w-32 text-sm px-2" value={material.name} onChange={(e) => updateMaterial(material.id, { name: e.target.value })} />
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={material.price} onChange={(v) => updateMaterial(material.id, { price: v })} />
                      <span className="text-gray-500">元 ×</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={material.quantity} onChange={(v) => updateMaterial(material.id, { quantity: v })} />
                      <span className="text-gray-500">=</span>
                    </div>
                    <span className="text-sm font-medium">{formatMoney(material.totalPrice || material.price * material.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeMaterial(material.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 杂费（工作人员） */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">杂费（工作人员）</span>
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={addOtherExpense}><Plus className="w-4 h-4 mr-1" />添加</Button>
                </div>
                {otherExpenses.otherExpenses.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <Input placeholder="项目名称" className="h-8 w-32 text-sm px-2" value={item.name} onChange={(e) => updateOtherExpense(item.id, { name: e.target.value })} />
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={item.price} onChange={(v) => updateOtherExpense(item.id, { price: v })} />
                      <span className="text-gray-500">元 ×</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={item.quantity} onChange={(v) => updateOtherExpense(item.id, { quantity: v })} />
                      <span className="text-gray-500">=</span>
                    </div>
                    <span className="text-sm font-medium">{formatMoney(item.totalPrice || item.price * item.quantity)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeOtherExpense(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧面板 */}
        <div className="w-[420px] flex-shrink-0 space-y-4 sticky top-14 self-start max-h-[calc(100vh-56px)] overflow-y-auto">
          {/* 成本核算与利润分析 */}
          <div ref={costProfitCardRef}>
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-800">成本核算与利润分析</CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">内部参考</p>
                </div>
                <div className="relative export-button-container">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowCostExportMenu(!showCostExportMenu)}>
                    <Download className="w-3 h-3" />
                  </Button>
                  {showCostExportMenu && (
                    <div className="absolute right-0 top-8 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[100px]">
                      <button
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleExportCostCard('image')}
                      >
                        <Image className="w-3 h-3" />图片
                      </button>
                      <button
                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleExportCostCard('pdf')}
                      >
                        <FileText className="w-3 h-3" />PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <div className="space-y-0 text-sm">
                {/* 住宿费明细 */}
                {projectData.project.type === 'multi-day' && summary.totalAccommodation > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">住宿费</span>
                      <span className="font-medium">{formatMoney(summary.totalAccommodation)}</span>
                    </div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {coreConfig.twinRoom && (coreConfig.twinRoom.countClient > 0 || coreConfig.twinRoom.countStaff > 0) && (
                        <div className="flex justify-between">
                          <span>双床房 {(coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0)}间 × {coreConfig.twinRoom.price}元/间 × {coreConfig.accommodationDays}晚</span>
                          <span>{formatMoney(((coreConfig.twinRoom.countClient || 0) + (coreConfig.twinRoom.countStaff || 0)) * (coreConfig.twinRoom.price || 0) * coreConfig.accommodationDays)}</span>
                        </div>
                      )}
                      {coreConfig.kingRoom && (coreConfig.kingRoom.countClient > 0 || coreConfig.kingRoom.countStaff > 0) && (
                        <div className="flex justify-between">
                          <span>大床房 {(coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0)}间 × {coreConfig.kingRoom.price}元/间 × {coreConfig.accommodationDays}晚</span>
                          <span>{formatMoney(((coreConfig.kingRoom.countClient || 0) + (coreConfig.kingRoom.countStaff || 0)) * (coreConfig.kingRoom.price || 0) * coreConfig.accommodationDays)}</span>
                        </div>
                      )}
                      {coreConfig.staffAccommodation && (
                        <div className="flex justify-between">
                          <span>工作人员住宿 {Math.ceil(totalStaff / 2)}间 × {coreConfig.staffRoomPrice || 0}元/间 × {coreConfig.staffAccommodationNights || 0}晚</span>
                          <span>{formatMoney(Math.ceil(totalStaff / 2) * (coreConfig.staffRoomPrice || 0) * (coreConfig.staffAccommodationNights || 0))}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* 用餐费明细 */}
                {summary.totalMeal > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">用餐费</span>
                      <span className="font-medium">{formatMoney(summary.totalMeal)}</span>
                    </div>
                    <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day, idx) => {
                        const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
                        const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
                        
                        // 使用与 calculation.ts 相同的计算逻辑
                        const calculateMeal = (meal: typeof lunch) => {
                          if (meal.enabled === false) return 0;
                          if (meal.amount && meal.amount > 0) return meal.amount;
                          const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
                          if ((meal.clientMealType || 'table') === 'table') {
                            const tables = meal.tableCount || Math.ceil(totalClients / 10);
                            return price * 10 * tables;
                          } else {
                            const count = meal.clientCount || totalClients;
                            return price * count;
                          }
                        };
                        
                        const lunchAmount = calculateMeal(lunch);
                        const dinnerAmount = calculateMeal(dinner);
                        if (lunchAmount === 0 && dinnerAmount === 0) return null;
                        
                        // 计算用餐明细
                        const getMealDetail = (meal: typeof lunch, amount: number) => {
                          if (amount === 0) return null;
                          const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
                          if ((meal.clientMealType || 'table') === 'table') {
                            const tables = meal.tableCount || Math.ceil(totalClients / 10);
                            const pricePerTable = price * 10;
                            return `${tables}桌 × ${pricePerTable}元/桌`;
                          } else {
                            const count = meal.clientCount || totalClients;
                            return `${count}人 × ${price}元/人`;
                          }
                        };
                        
                        return (
                          <div key={idx} className="space-y-0.5">
                            {lunchAmount > 0 && (
                              <div className="flex justify-between">
                                <span>D{day.day}中餐{lunch.restaurantName ? `(${lunch.restaurantName})` : ''} {getMealDetail(lunch, lunchAmount)}</span>
                                <span>{formatMoney(lunchAmount)}</span>
                              </div>
                            )}
                            {dinnerAmount > 0 && (
                              <div className="flex justify-between">
                                <span>D{day.day}晚餐{dinner.restaurantName ? `(${dinner.restaurantName})` : ''} {getMealDetail(dinner, dinnerAmount)}</span>
                                <span>{formatMoney(dinnerAmount)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                {/* 交通费明细 */}
                {summary.totalBus > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">交通费</span>
                      <span className="font-medium">{formatMoney(summary.totalBus)}</span>
                    </div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {coreConfig.busFee > 0 && (
                        <div className="flex justify-between">
                          <span>大巴</span>
                          <span>{formatMoney(coreConfig.busFee)}</span>
                        </div>
                      )}
                      {(coreConfig.otherTransports || []).map((t) => (
                        <div key={t.id} className="flex justify-between">
                          <span>{t.type === 'flight' ? '飞机' : '高铁'} {t.count}张 × {t.price}元/张</span>
                          <span>{formatMoney(t.price * t.count)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                {/* 工作人员明细 */}
                {summary.totalStaffFee > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">工作人员</span>
                      <span className="font-medium">{formatMoney(summary.totalStaffFee)}</span>
                    </div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {coreConfig.staffMembers.filter(m => m.count > 0).map((member) => {
                        // 计算该工作人员的实际总费用（使用每日费用中的实际日薪）
                        let actualTotalFee = 0;
                        let firstDailyFee = 0;
                        dailyExpenses.forEach(day => {
                          const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
                          if (dailyFee > 0 && firstDailyFee === 0) {
                            firstDailyFee = dailyFee;
                          }
                          actualTotalFee += dailyFee * member.count;
                        });
                        // 显示的日薪：优先使用找到的第一个有效日薪，否则使用核心配置
                        const displayDailyFee = firstDailyFee || member.dailyFee;
                        return (
                          <div key={member.id} className="flex justify-between">
                            <span>{member.name} {member.count}人 × {displayDailyFee}元/天 × {coreConfig.tripDays}天</span>
                            <span>{formatMoney(actualTotalFee)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                {/* 活动项目明细 */}
                {summary.totalSingleItems > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">活动项目</span>
                      <span className="font-medium">{formatMoney(summary.totalSingleItems)}</span>
                    </div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {dailyExpenses.map((day) => 
                        day.singleItems.filter(item => item.name && (item.totalPrice || item.price * item.count) > 0).map((item, idx) => (
                          <div key={`${day.day}-${idx}`} className="flex justify-between">
                            <span>D{day.day} {item.name} {item.price}元 × {item.count}{item.unit || '人'}</span>
                            <span>{formatMoney(item.totalPrice || item.price * item.count)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
                
                {/* 其他费用明细 */}
                {summary.totalOtherExpenses > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">其他费用</span>
                      <span className="font-medium">{formatMoney(summary.totalOtherExpenses)}</span>
                    </div>
                    <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                      {otherExpenses.insurance.totalAmount > 0 && (
                        <div className="flex justify-between">
                          <span>保险 {otherExpenses.insurance.pricePerPerson}元/人/天 × {otherExpenses.insurance.days}天 × {totalClients + totalStaff}人</span>
                          <span>{formatMoney(otherExpenses.insurance.totalAmount)}</span>
                        </div>
                      )}
                      {otherExpenses.reserveFund > 0 && (
                        <div className="flex justify-between">
                          <span>备用金</span>
                          <span>{formatMoney(otherExpenses.reserveFund)}</span>
                        </div>
                      )}
                      {otherExpenses.materials.filter(m => m.totalPrice > 0 || m.price * m.quantity > 0).map((m, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>杂费(客户)-{m.name} {m.price}元 × {m.quantity}</span>
                          <span>{formatMoney(m.totalPrice || m.price * m.quantity)}</span>
                        </div>
                      ))}
                      {otherExpenses.otherExpenses.filter(o => o.totalPrice > 0 || o.price * o.quantity > 0).map((o, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>杂费(工作人员)-{o.name || '其他'} {o.price}元 × {o.quantity}</span>
                          <span>{formatMoney(o.totalPrice || o.price * o.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3"><span className="font-semibold text-gray-800">总成本</span><span className="font-bold text-gray-900 text-xl">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between items-center py-2 text-gray-500 border-b border-gray-100">
                  <span>人均成本</span>
                  <div className="flex items-center gap-1">
                    <NumberInput 
                      className="h-7 w-16 text-sm px-2 text-right border rounded" 
                      value={coreConfig.pricingCount ?? totalClients} 
                      onChange={(v) => updateData({ coreConfig: { ...coreConfig, pricingCount: v } })}
                    />
                    <span>人，</span>
                    <span className="font-medium text-gray-700">{formatMoney(summary.totalCost / (coreConfig.pricingCount || totalClients || 1))}/人</span>
                  </div>
                </div>
                
                {/* 利润分析 */}
                <div className="mt-4 pt-3 border-t-2 border-gray-200">
                  <div className="text-sm font-semibold text-gray-700 mb-2">利润分析</div>
                  {(() => {
                    // 计算住宿费报价
                    const twinQuotePrice = coreConfig.twinRoom?.quotePrice ?? coreConfig.twinRoom?.price ?? 0;
                    const kingQuotePrice = coreConfig.kingRoom?.quotePrice ?? coreConfig.kingRoom?.price ?? 0;
                    const quoteAccommodation = (coreConfig.twinRoom?.countClient || 0) * twinQuotePrice * coreConfig.accommodationDays +
                                               (coreConfig.kingRoom?.countClient || 0) * kingQuotePrice * coreConfig.accommodationDays;
                    
                    // 计算用餐费报价 - 使用与 calculation.ts 相同的计算逻辑
                    const calculateMealAmountLocal = (meal: typeof DEFAULT_MEAL_CONFIG) => {
                      if (meal.enabled === false) return 0;
                      if (meal.amount && meal.amount > 0) return meal.amount;
                      const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
                      const clientMealType = meal.clientMealType || 'table';
                      if (clientMealType === 'table') {
                        const tables = meal.tableCount || Math.ceil(totalClients / 10);
                        return price * 10 * tables;
                      } else {
                        const count = meal.clientCount || totalClients;
                        return price * count;
                      }
                    };
                    
                    const quoteMealTotal = dailyExpenses.reduce((total, day) => {
                      const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
                      const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
                      const lunchQuote = lunch.quoteAmount ?? calculateMealAmountLocal(lunch);
                      const dinnerQuote = dinner.quoteAmount ?? calculateMealAmountLocal(dinner);
                      return total + lunchQuote + dinnerQuote;
                    }, 0);
                    
                    // 计算交通费报价
                    const busQuote = coreConfig.busQuoteFee ?? coreConfig.busFee ?? 0;
                    const transportsQuote = (coreConfig.otherTransports || []).reduce((s, t) => {
                      const qPrice = t.quotePrice ?? t.price;
                      return s + qPrice * t.count;
                    }, 0);
                    const quoteBus = busQuote + transportsQuote;
                    
                    // 计算活动项目报价
                    const quoteSingleItemsTotal = dailyExpenses.flatMap(d => d.singleItems).filter(i => i.name).reduce((s, item) => s + (item.quoteTotalPrice || (item.quotePrice || item.price) * item.count), 0);
                    
                    // 计算其他费用报价
                    const insuranceQuote = otherExpenses.insurance.quoteAmount ?? otherExpenses.insurance.totalAmount;
                    const materialsQuote = otherExpenses.materials.reduce((s, m) => s + (m.quoteTotalPrice ?? m.totalPrice ?? m.price * m.quantity), 0);
                    const quoteOtherExpenses = insuranceQuote + materialsQuote;
                    
                    // 报价小计
                    const quoteSubtotal = quoteAccommodation + quoteMealTotal + quoteBus + quoteSingleItemsTotal + quoteOtherExpenses;
                    const quoteServiceFee = calculateServiceFee(quoteSubtotal, otherExpenses.serviceFeePercent);
                    const quoteTax = (quoteSubtotal + quoteServiceFee) * (otherExpenses.taxPercent ?? 1) / 100;
                    const quoteTotal = quoteSubtotal + quoteServiceFee + quoteTax;
                    
                    // 最终营收
                    const revenue = quoteTotal - discount;
                    const pricingPeople = coreConfig.pricingCount ?? totalClients;
                    const pricePerPerson = pricingPeople > 0 ? revenue / pricingPeople : 0;
                    // 成本
                    const cost = summary.totalCost;
                    // 利润
                    const profit = revenue - cost;
                    // 利润率
                    const profitRate = revenue > 0 ? (profit / revenue * 100) : 0;
                    
                    // 计算差价
                    const accommodationDiff = quoteAccommodation - summary.totalAccommodation;
                    const mealDiff = quoteMealTotal - summary.totalMeal;
                    const busDiff = quoteBus - summary.totalBus;
                    const singleItemsDiff = quoteSingleItemsTotal - summary.totalSingleItems;
                    const insuranceDiff = insuranceQuote - otherExpenses.insurance.totalAmount;
                    const materialsDiff = materialsQuote - otherExpenses.materials.reduce((s, m) => s + (m.totalPrice || m.price * m.quantity), 0);
                    
                    return (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-600">营收</span>
                          <span className="font-medium text-gray-800">{formatMoney(revenue)}</span>
                        </div>
                        <div className="pl-2 text-xs text-gray-500 space-y-0.5 py-1 border-b border-gray-50">
                          <div className="flex justify-between">
                            <span>报价合计 {formatMoney(quoteTotal)} - 优惠 {formatMoney(discount)}</span>
                            <span>{formatMoney(revenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>{pricingPeople}人 × {formatMoney(pricePerPerson)}/人</span>
                            <span></span>
                          </div>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-600">成本</span>
                          <span className="font-medium text-gray-800">{formatMoney(cost)}</span>
                        </div>
                        <div className="flex justify-between py-2 bg-gray-50 rounded mt-1 px-2">
                          <span className="font-semibold text-gray-800">利润</span>
                          <span className={`font-bold text-lg ${profit >= 0 ? 'text-red-600' : 'text-green-600'}`}>{profit >= 0 ? '+' : ''}{formatMoney(profit)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-gray-100">
                          <span className="text-gray-600">利润率</span>
                          <span className={`font-medium ${profitRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>{profitRate.toFixed(1)}%</span>
                        </div>
                        {(accommodationDiff !== 0 || mealDiff !== 0 || busDiff !== 0 || singleItemsDiff !== 0 || insuranceDiff !== 0 || materialsDiff !== 0) && (
                          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-0.5">
                            {accommodationDiff !== 0 && (
                              <div className="flex justify-between">
                                <span>住宿费差价</span>
                                <span className={accommodationDiff >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {accommodationDiff >= 0 ? '+' : ''}{formatMoney(accommodationDiff)}
                                </span>
                              </div>
                            )}
                            {mealDiff !== 0 && (
                              <div className="flex justify-between">
                                <span>用餐费差价</span>
                                <span className={mealDiff >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {mealDiff >= 0 ? '+' : ''}{formatMoney(mealDiff)}
                                </span>
                              </div>
                            )}
                            {busDiff !== 0 && (
                              <div className="flex justify-between">
                                <span>交通费差价</span>
                                <span className={busDiff >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {busDiff >= 0 ? '+' : ''}{formatMoney(busDiff)}
                                </span>
                              </div>
                            )}
                            {singleItemsDiff !== 0 && (
                              <div className="flex justify-between">
                                <span>活动项目差价</span>
                                <span className={singleItemsDiff >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {singleItemsDiff >= 0 ? '+' : ''}{formatMoney(singleItemsDiff)}
                                </span>
                              </div>
                            )}
                            {insuranceDiff !== 0 && (
                              <div className="flex justify-between">
                                <span>保险费差价</span>
                                <span className={insuranceDiff >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {insuranceDiff >= 0 ? '+' : ''}{formatMoney(insuranceDiff)}
                                </span>
                              </div>
                            )}
                            {materialsDiff !== 0 && (
                              <div className="flex justify-between">
                                <span>杂费差价</span>
                                <span className={materialsDiff >= 0 ? 'text-red-600' : 'text-green-600'}>
                                  {materialsDiff >= 0 ? '+' : ''}{formatMoney(materialsDiff)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* 报价单 */}
          <div ref={quoteCardRef}>
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-gray-800">{projectData.project.name} 报价单</CardTitle>
                <div className="flex items-center gap-2 export-button-container">
                  {isQuoteEditing ? (
                    <Button size="sm" className="h-7 text-xs" onClick={() => { setIsQuoteEditing(false); handleSave(); }}>
                      <Check className="w-3 h-3 mr-1" />保存
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsQuoteEditing(true)}>
                      <Pencil className="w-3 h-3 mr-1" />编辑
                    </Button>
                  )}
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowQuoteExportMenu(!showQuoteExportMenu)}>
                      <Download className="w-3 h-3" />
                    </Button>
                    {showQuoteExportMenu && (
                      <div className="absolute right-0 top-8 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[100px]">
                        <button
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => handleExportQuoteCard('image')}
                        >
                          <Image className="w-3 h-3" />图片
                        </button>
                        <button
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => handleExportQuoteCard('pdf')}
                        >
                          <FileText className="w-3 h-3" />PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-3 px-4">
              {(() => {
                // 计算住宿费报价
                const twinQuotePrice = coreConfig.twinRoom?.quotePrice ?? coreConfig.twinRoom?.price ?? 0;
                const kingQuotePrice = coreConfig.kingRoom?.quotePrice ?? coreConfig.kingRoom?.price ?? 0;
                const quoteAccommodation = (coreConfig.twinRoom?.countClient || 0) * twinQuotePrice * coreConfig.accommodationDays +
                                           (coreConfig.kingRoom?.countClient || 0) * kingQuotePrice * coreConfig.accommodationDays;
                
                // 计算用餐费报价 - 使用与 calculation.ts 相同的计算逻辑
                const calculateMealAmountLocal = (meal: typeof DEFAULT_MEAL_CONFIG) => {
                  // 如果未启用，返回0
                  if (meal.enabled === false) return 0;
                  // 如果有手动输入的金额，直接使用
                  if (meal.amount && meal.amount > 0) {
                    return meal.amount;
                  }
                  // 使用单价（优先使用每餐配置的单价，否则使用客户配置的餐标）
                  const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
                  // 客户餐费
                  const clientMealType = meal.clientMealType || 'table';
                  if (clientMealType === 'table') {
                    const tables = meal.tableCount || Math.ceil(totalClients / 10);
                    return price * 10 * tables;
                  } else {
                    const count = meal.clientCount || totalClients;
                    return price * count;
                  }
                };
                
                const quoteMealTotal = dailyExpenses.reduce((total, day) => {
                  const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
                  const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
                  // 优先使用报价金额，否则使用计算出的金额
                  const lunchQuote = lunch.quoteAmount ?? calculateMealAmountLocal(lunch);
                  const dinnerQuote = dinner.quoteAmount ?? calculateMealAmountLocal(dinner);
                  return total + lunchQuote + dinnerQuote;
                }, 0);
                
                // 计算交通费报价
                const busQuote = coreConfig.busQuoteFee ?? coreConfig.busFee ?? 0;
                const transportsQuote = (coreConfig.otherTransports || []).reduce((s, t) => {
                  const qPrice = t.quotePrice ?? t.price;
                  return s + qPrice * t.count;
                }, 0);
                const quoteBus = busQuote + transportsQuote;
                
                // 计算活动项目报价
                const quoteSingleItemsTotal = dailyExpenses.flatMap(d => d.singleItems).filter(i => i.name).reduce((s, item) => s + (item.quoteTotalPrice || (item.quotePrice || item.price) * item.count), 0);
                
                // 计算其他费用报价（保险、杂费等）
                const insuranceQuote = otherExpenses.insurance.quoteAmount ?? otherExpenses.insurance.totalAmount;
                const materialsQuote = otherExpenses.materials.reduce((s, m) => s + (m.quoteTotalPrice ?? m.totalPrice ?? m.price * m.quantity), 0);
                const quoteOtherExpenses = insuranceQuote + materialsQuote;
                
                // 报价小计
                const quoteSubtotal = quoteAccommodation + quoteMealTotal + quoteBus + quoteSingleItemsTotal + quoteOtherExpenses;
                const quoteServiceFee = calculateServiceFee(quoteSubtotal, otherExpenses.serviceFeePercent);
                const quoteTax = (quoteSubtotal + quoteServiceFee) * (otherExpenses.taxPercent ?? 1) / 100;
                const quoteTotal = quoteSubtotal + quoteServiceFee + quoteTax;
                const quoteFinalPrice = quoteTotal - discount;
                const quotePricePerClient = totalClients > 0 ? quoteFinalPrice / totalClients : 0;
                
                return (
                  <div className="space-y-0 text-sm">
                    {/* 住宿费明细 */}
                    {projectData.project.type === 'multi-day' && quoteAccommodation > 0 && (
                      <>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">住宿费</span>
                          <span className="font-medium">{formatMoney(quoteAccommodation)}</span>
                        </div>
                        <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                          {coreConfig.twinRoom && coreConfig.twinRoom.countClient > 0 && (
                            <div className="flex justify-between items-center">
                              <span>双床房 {coreConfig.twinRoom.countClient}间</span>
                              <div className="flex items-center gap-1">
                                {isQuoteEditing ? (
                                  <NumberInput 
                                    className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                    value={twinQuotePrice} 
                                    onChange={(v) => {
                                      updateData({ 
                                        coreConfig: { 
                                          ...coreConfig, 
                                          twinRoom: { ...coreConfig.twinRoom!, quotePrice: v } 
                                        } 
                                      });
                                    }}
                                  />
                                ) : (
                                  <span className="w-16 text-right">{twinQuotePrice}</span>
                                )}
                                <span>元/晚 × {coreConfig.accommodationDays}晚</span>
                                <span className="w-14 text-right font-medium">{formatMoney(coreConfig.twinRoom.countClient * twinQuotePrice * coreConfig.accommodationDays)}</span>
                              </div>
                            </div>
                          )}
                          {coreConfig.kingRoom && coreConfig.kingRoom.countClient > 0 && (
                            <div className="flex justify-between items-center">
                              <span>大床房 {coreConfig.kingRoom.countClient}间</span>
                              <div className="flex items-center gap-1">
                                {isQuoteEditing ? (
                                  <NumberInput 
                                    className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                    value={kingQuotePrice} 
                                    onChange={(v) => {
                                      updateData({ 
                                        coreConfig: { 
                                          ...coreConfig, 
                                          kingRoom: { ...coreConfig.kingRoom!, quotePrice: v } 
                                        } 
                                      });
                                    }}
                                  />
                                ) : (
                                  <span className="w-16 text-right">{kingQuotePrice}</span>
                                )}
                                <span>元/晚 × {coreConfig.accommodationDays}晚</span>
                                <span className="w-14 text-right font-medium">{formatMoney(coreConfig.kingRoom.countClient * kingQuotePrice * coreConfig.accommodationDays)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* 用餐费明细 */}
                    {summary.totalMeal > 0 && (
                      <>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">用餐费</span>
                          <span className="font-medium">{formatMoney(quoteMealTotal)}</span>
                        </div>
                        <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                          {dailyExpenses.map((day) => {
                            const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
                            const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
                            
                            // 使用与 calculation.ts 相同的计算逻辑
                            const calculateMeal = (meal: typeof lunch) => {
                              if (meal.enabled === false) return 0;
                              if (meal.amount && meal.amount > 0) return meal.amount;
                              const price = meal.pricePerPerson || coreConfig.mealStandardClient || 0;
                              if ((meal.clientMealType || 'table') === 'table') {
                                const tables = meal.tableCount || Math.ceil(totalClients / 10);
                                return price * 10 * tables;
                              } else {
                                const count = meal.clientCount || totalClients;
                                return price * count;
                              }
                            };
                            
                            const lunchAmount = calculateMeal(lunch);
                            const dinnerAmount = calculateMeal(dinner);
                            if (lunchAmount === 0 && dinnerAmount === 0) return null;
                            
                            const lunchQuote = lunch.quoteAmount ?? lunchAmount;
                            const dinnerQuote = dinner.quoteAmount ?? dinnerAmount;
                            
                            const updateMealQuote = (mealType: 'lunch' | 'dinner', value: number) => {
                              const newDays = [...dailyExpenses];
                              const dayData = newDays.find(d => d.day === day.day);
                              if (dayData) {
                                dayData[mealType] = { ...dayData[mealType], quoteAmount: value };
                                updateData({ dailyExpenses: newDays });
                              }
                            };
                            
                            return (
                              <div key={day.day} className="space-y-1">
                                {lunchAmount > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span>D{day.day}中餐{lunch.restaurantName ? `(${lunch.restaurantName})` : ''}</span>
                                    <div className="flex items-center gap-1">
                                      {isQuoteEditing ? (
                                        <NumberInput 
                                          className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                          value={lunchQuote} 
                                          onChange={(v) => updateMealQuote('lunch', v)}
                                        />
                                      ) : (
                                        <span className="w-16 text-right">{formatMoney(lunchQuote)}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {dinnerAmount > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span>D{day.day}晚餐{dinner.restaurantName ? `(${dinner.restaurantName})` : ''}</span>
                                    <div className="flex items-center gap-1">
                                      {isQuoteEditing ? (
                                        <NumberInput 
                                          className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                          value={dinnerQuote} 
                                          onChange={(v) => updateMealQuote('dinner', v)}
                                        />
                                      ) : (
                                        <span className="w-16 text-right">{formatMoney(dinnerQuote)}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    
                    {/* 交通费明细 */}
                    {quoteBus > 0 && (
                      <>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">交通费</span>
                          <span className="font-medium">{formatMoney(quoteBus)}</span>
                        </div>
                        <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                          {coreConfig.busFee > 0 && (
                            <div className="flex justify-between items-center">
                              <span>大巴租赁</span>
                              <div className="flex items-center gap-1">
                                {isQuoteEditing ? (
                                  <NumberInput 
                                    className="h-6 w-20 text-xs px-1 text-right border rounded" 
                                    value={busQuote} 
                                    onChange={(v) => updateData({ coreConfig: { ...coreConfig, busQuoteFee: v } })}
                                  />
                                ) : (
                                  <span className="w-20 text-right">{formatMoney(busQuote)}</span>
                                )}
                              </div>
                            </div>
                          )}
                          {(coreConfig.otherTransports || []).map((t) => {
                            const tQuotePrice = t.quotePrice ?? t.price;
                            return (
                              <div key={t.id} className="flex justify-between items-center">
                                <span>{t.type === 'flight' ? '飞机票' : '高铁票'} {t.count}张</span>
                                <div className="flex items-center gap-1">
                                  {isQuoteEditing ? (
                                    <NumberInput 
                                      className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                      value={tQuotePrice} 
                                      onChange={(v) => {
                                        const newTransports = (coreConfig.otherTransports || []).map(item => 
                                          item.id === t.id ? { ...item, quotePrice: v } : item
                                        );
                                        updateData({ coreConfig: { ...coreConfig, otherTransports: newTransports } });
                                      }}
                                    />
                                  ) : (
                                    <span className="w-16 text-right">{tQuotePrice}</span>
                                  )}
                                  <span>元/张</span>
                                  <span className="w-14 text-right font-medium">{formatMoney(tQuotePrice * t.count)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    
                    {/* 活动项目明细 */}
                    {dailyExpenses.flatMap(d => d.singleItems).filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).length > 0 && (
                      <>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">活动项目</span>
                          <span className="font-medium">{formatMoney(quoteSingleItemsTotal)}</span>
                        </div>
                        <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                          {dailyExpenses.map((day) => 
                            day.singleItems.filter(item => item.name && (item.totalPrice || item.price * item.count) > 0).map((item, idx) => {
                              const qPrice = item.quotePrice ?? item.price;
                              const qTotal = item.quoteTotalPrice ?? (qPrice * item.count);
                              return (
                                <div key={`${day.day}-${idx}`} className="flex justify-between items-center">
                                  <span>D{day.day} {item.name}</span>
                                  <div className="flex items-center gap-1">
                                    {isQuoteEditing ? (
                                      <NumberInput 
                                        className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                        value={qPrice} 
                                        onChange={(v) => {
                                          const newDays = [...dailyExpenses];
                                          const dayData = newDays.find(d => d.day === day.day);
                                          if (dayData) {
                                            const itemData = dayData.singleItems.find(i => i.id === item.id);
                                            if (itemData) {
                                              itemData.quotePrice = v;
                                              itemData.quoteTotalPrice = v * itemData.count;
                                              updateData({ dailyExpenses: newDays });
                                            }
                                          }
                                        }}
                                      />
                                    ) : (
                                      <span className="w-16 text-right">{qPrice}</span>
                                    )}
                                    <span>×</span>
                                    <span>{item.count}{item.unit || '人'}</span>
                                    <span>=</span>
                                    <span className="font-medium w-14 text-right">{formatMoney(qTotal)}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                    
                    {/* 保险费 */}
                    {otherExpenses.insurance.totalAmount > 0 && (() => {
                      const insuranceQuote = otherExpenses.insurance.quoteAmount ?? otherExpenses.insurance.totalAmount;
                      return (
                        <>
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600 font-medium">保险费</span>
                            <span className="font-medium">{formatMoney(insuranceQuote)}</span>
                          </div>
                          <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                            <div className="flex justify-between items-center">
                              <span>{totalClients}人 × {otherExpenses.insurance.days}天</span>
                              <div className="flex items-center gap-1">
                                {isQuoteEditing ? (
                                  <NumberInput 
                                    className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                    value={insuranceQuote} 
                                    onChange={(v) => {
                                      updateData({ 
                                        otherExpenses: { 
                                          ...otherExpenses, 
                                          insurance: { ...otherExpenses.insurance, quoteAmount: v } 
                                        } 
                                      });
                                    }}
                                  />
                                ) : (
                                  <span className="w-16 text-right">{formatMoney(insuranceQuote)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    
                    {/* 杂费（客户） */}
                    {otherExpenses.materials.filter(m => m.totalPrice > 0 || m.price * m.quantity > 0).length > 0 && (
                      <>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">杂费</span>
                          <span className="font-medium">{formatMoney(otherExpenses.materials.reduce((s, m) => s + (m.quoteTotalPrice ?? m.totalPrice ?? m.price * m.quantity), 0))}</span>
                        </div>
                        <div className="pl-2 text-xs text-gray-500 space-y-1 py-1 border-b border-gray-50">
                          {otherExpenses.materials.filter(m => m.totalPrice > 0 || m.price * m.quantity > 0).map((m, idx) => {
                            const mQuote = m.quoteTotalPrice ?? m.totalPrice ?? m.price * m.quantity;
                            return (
                              <div key={m.id || idx} className="flex justify-between items-center">
                                <span>{m.name || `项目${idx + 1}`}</span>
                                <div className="flex items-center gap-1">
                                  {isQuoteEditing ? (
                                    <NumberInput 
                                      className="h-6 w-16 text-xs px-1 text-right border rounded" 
                                      value={mQuote} 
                                      onChange={(v) => {
                                        const newMaterials = otherExpenses.materials.map(item => 
                                          item.id === m.id ? { ...item, quoteTotalPrice: v } : item
                                        );
                                        updateData({ otherExpenses: { ...otherExpenses, materials: newMaterials } });
                                      }}
                                    />
                                  ) : (
                                    <span className="w-16 text-right">{formatMoney(mQuote)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    
                    {/* 小计 */}
                    <div className="flex justify-between py-2 bg-gray-50 rounded px-2 mt-2">
                      <span className="text-gray-600">小计</span>
                      <span className="font-medium">{formatMoney(quoteSubtotal)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">服务费 ({otherExpenses.serviceFeePercent}%)</span>
                      <span className="font-medium">{formatMoney(quoteServiceFee)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">税费 ({otherExpenses.taxPercent ?? 1}%)</span>
                      <span className="font-medium">{formatMoney(quoteTax)}</span>
                    </div>
                    <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3">
                      <span className="font-semibold text-gray-800">报价合计</span>
                      <span className="font-bold text-gray-900 text-xl">{formatMoney(quoteTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">优惠</span>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">-</span>
                        {isQuoteEditing ? (
                          <NumberInput className="h-8 w-20 text-sm px-2 text-right border rounded" value={discount} onChange={(v) => setDiscount(v)} />
                        ) : (
                          <span className="font-medium">{formatMoney(discount)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between py-2.5 bg-gray-100 rounded mt-2 px-3">
                      <span className="font-bold text-gray-800">应付金额</span>
                      <span className="font-bold text-gray-900 text-2xl">{formatMoney(quoteFinalPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 text-gray-500">
                      <span>人均费用</span>
                      <div className="flex items-center gap-1">
                        {isQuoteEditing ? (
                          <>
                            <NumberInput 
                              className="h-7 w-16 text-sm px-2 text-right border rounded" 
                              value={coreConfig.pricingCount ?? totalClients} 
                              onChange={(v) => updateData({ coreConfig: { ...coreConfig, pricingCount: v } })}
                            />
                            <span>人，</span>
                          </>
                        ) : (
                          <span>{coreConfig.pricingCount ?? totalClients}人，</span>
                        )}
                        <span className="font-medium text-gray-700">{formatMoney(quoteFinalPrice / (coreConfig.pricingCount || totalClients || 1))}/人</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
