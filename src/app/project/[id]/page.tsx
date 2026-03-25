'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, Plus, Trash2, LayoutGrid, Calendar } from 'lucide-react';
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
import { getProjectData, updateProjectData } from '@/lib/storage';
import { calculateCostSummary, calculateServiceFee, formatMoney } from '@/lib/calculation';

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'half-day', label: '半日' },
  { value: 'one-day', label: '一日' },
  { value: 'multi-day', label: '多日' },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [viewMode, setViewMode] = useState<'project' | 'daily'>('project'); // 查看模式：按项目/按日期

  useEffect(() => {
    const data = getProjectData(id);
    if (data) {
      // 迁移旧数据格式
      migrateOldData(data);
      setProjectData(data);
    }
    else { alert('项目不存在'); router.push('/'); }
  }, [id, router]);

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
        reserveFund: old.reserveFund || 0,
        materials: [],
        otherExpenses: old.other ? [{ id: '1', remark: '其他', amount: old.other || 0 }] : [],
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
    setProjectData({ ...projectData, ...updates });
  };

  const handleSave = () => {
    if (!projectData) return;
    setIsSaving(true);
    updateProjectData(projectData);
    setTimeout(() => { setIsSaving(false); alert('保存成功！'); }, 300);
  };

  const handleExport = () => {
    if (!projectData) return;
    
    const { coreConfig: cfg, dailyExpenses: days, otherExpenses: other } = projectData;
    const summary = calculateCostSummary(projectData);
    const serviceFee = calculateServiceFee(summary.totalCost, other.serviceFeePercent || 10);
    const tax = (summary.totalCost + serviceFee) * 0.06;
    const totalPrice = summary.totalCost + serviceFee + tax;
    const finalPrice = totalPrice - discount;
    
    const projectTypeLabel = projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${cfg.tripDays}天`;
    
    // 安全获取保险数据
    const insurance = other.insurance && typeof other.insurance === 'object' 
      ? other.insurance 
      : { totalAmount: 0 };
    const materials = other.materials || [];
    const otherList = other.otherExpenses || [];
    const transports = cfg.otherTransports || [];
    
    const lines = ['═'.repeat(50), '研学旅行报价单', '═'.repeat(50),
      `项目名称：${projectData.project.name}`,
      `行程类型：${projectTypeLabel}`,
      `客户人数：${summary.totalClients}人`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '', '─'.repeat(50), '费用明细', '─'.repeat(50),
    ];
    
    if (viewMode === 'project') {
      // 按项目模式
      if (summary.totalAccommodation > 0) lines.push(`住宿费用：${formatMoney(summary.totalAccommodation)}`);
      if (summary.totalMeal > 0) lines.push(`用餐费用：${formatMoney(summary.totalMeal)}`);
      if (summary.totalBus > 0) lines.push(`交通费用：${formatMoney(summary.totalBus)}`);
      if (summary.totalSingleItems > 0) lines.push(`活动费用：${formatMoney(summary.totalSingleItems)}`);
      if (insurance.totalAmount > 0) lines.push(`保险费用：${formatMoney(insurance.totalAmount)}`);
      if (materials.length > 0) {
        const materialsTotal = materials.reduce((s, m) => s + (m.totalPrice || m.price * m.quantity), 0);
        lines.push(`杂费（客户）：${formatMoney(materialsTotal)}`);
      }
      if (otherList.length > 0) {
        const otherTotal = otherList.reduce((s, o) => s + o.amount, 0);
        lines.push(`杂费（工作人员）：${formatMoney(otherTotal)}`);
      }
    } else {
      // 按日期模式
      days.forEach(day => {
        const dayAccommodation = projectData.project.type === 'multi-day' ? day.accommodation : 0;
        const dayLunch = day.lunch?.amount || (day.lunch?.pricePerPerson * (day.lunch?.clientMealType === 'table' ? day.lunch.tableCount * 10 : day.lunch?.clientCount)) || 0;
        const dayDinner = day.dinner?.amount || (day.dinner?.pricePerPerson * (day.dinner?.clientMealType === 'table' ? day.dinner.tableCount * 10 : day.dinner?.clientCount)) || 0;
        const daySingleItems = (day.singleItems || []).reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0);
        const dayTotal = dayAccommodation + dayLunch + dayDinner + daySingleItems;
        
        if (dayTotal > 0) {
          lines.push(``, `【第${day.day}天】 ${formatMoney(dayTotal)}`);
          if (dayAccommodation > 0) lines.push(`  住宿：${formatMoney(dayAccommodation)}`);
          if (dayLunch > 0) lines.push(`  中餐：${formatMoney(dayLunch)}`);
          if (dayDinner > 0) lines.push(`  晚餐：${formatMoney(dayDinner)}`);
          (day.singleItems || []).filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).forEach(item => {
            lines.push(`  ${item.name}：${formatMoney(item.totalPrice || item.price * item.count)}`);
          });
        }
      });
      
      // 其他费用
      if (insurance.totalAmount > 0 || materials.some(m => (m.totalPrice || m.price * m.quantity) > 0)) {
        lines.push(``, `【其他费用】`);
        if (insurance.totalAmount > 0) lines.push(`  保险：${formatMoney(insurance.totalAmount)}`);
        materials.filter(m => (m.totalPrice || m.price * m.quantity) > 0).forEach(m => {
          lines.push(`  ${m.name || '杂费'}：${formatMoney(m.totalPrice || m.price * m.quantity)}`);
        });
      }
      
      // 交通费
      if (summary.totalBus > 0) {
        lines.push(``, `【交通费】 ${formatMoney(summary.totalBus)}`);
        if (cfg.busFee > 0) lines.push(`  大巴：${formatMoney(cfg.busFee)}`);
        transports.forEach(t => {
          lines.push(`  ${t.type === 'flight' ? '飞机' : '高铁'}：${formatMoney(t.price * t.count)}`);
        });
      }
    }
    
    lines.push('', '─'.repeat(50), `小计：${formatMoney(summary.totalCost)}`, 
      `服务费(${other.serviceFeePercent || 10}%)：${formatMoney(serviceFee)}`, 
      `税费(6%)：${formatMoney(tax)}`,
      `报价合计：${formatMoney(totalPrice)}`, 
      `优惠：-${formatMoney(discount)}`, 
      '', '═'.repeat(50), 
      `应付金额：${formatMoney(finalPrice)}`, 
      `人均费用：${formatMoney(finalPrice / (summary.totalClients || 1))}`);
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.project.name}-报价单.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!projectData) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>;

  const { coreConfig, dailyExpenses, otherExpenses } = projectData;
  const summary = calculateCostSummary(projectData);
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = (coreConfig.staffMembers || []).reduce((sum, m) => sum + (m.count || 0), 0);
  const totalPeople = totalClients + totalStaff;

  // 安全获取数据（不修改原状态）
  const safeStaffMembers = coreConfig.staffMembers && coreConfig.staffMembers.length > 0 
    ? coreConfig.staffMembers 
    : DEFAULT_STAFF_MEMBERS;
  
  const safeInsurance = otherExpenses.insurance && typeof otherExpenses.insurance === 'object'
    ? otherExpenses.insurance
    : { ...DEFAULT_INSURANCE_CONFIG, days: coreConfig.tripDays || 1 };
  
  const safeMaterials = otherExpenses.materials || [];
  const safeOtherExpensesList = otherExpenses.otherExpenses || [];
  const safeOtherTransports = coreConfig.otherTransports || [];

  // 确保每日数据格式正确
  const safeDailyExpenses = dailyExpenses.map((day, idx) => ({
    ...day,
    singleItems: (day.singleItems || []).map(item => ({
      ...item,
      unit: item.unit || '人' as const
    }))
  }));

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
    const newMembers = coreConfig.staffMembers.map(m => 
      m.id === id ? { ...m, ...updates } : m
    );
    updateData({ coreConfig: { ...coreConfig, staffMembers: newMembers } });
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
        otherExpenses: [...otherExpenses.otherExpenses, { id: `other_${Date.now()}`, remark: '', amount: 0 }]
      }
    });
  };

  // 更新其他费用
  const updateOtherExpense = (id: string, updates: Partial<OtherExpenseItem>) => {
    const newOthers = otherExpenses.otherExpenses.map(o => 
      o.id === id ? { ...o, ...updates } : o
    );
    updateData({ otherExpenses: { ...otherExpenses, otherExpenses: newOthers } });
  };

  // 删除其他费用
  const removeOtherExpense = (id: string) => {
    updateData({
      otherExpenses: { ...otherExpenses, otherExpenses: otherExpenses.otherExpenses.filter(o => o.id !== id) }
    });
  };

  const serviceFee = calculateServiceFee(summary.totalCost, otherExpenses.serviceFeePercent);
  const tax = (summary.totalCost + serviceFee) * 0.06;
  const totalPrice = summary.totalCost + serviceFee + tax;
  const finalPrice = totalPrice - discount;
  const pricePerClient = totalClients > 0 ? finalPrice / totalClients : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Input value={projectData.project.name} onChange={(e) => updateData({ project: { ...projectData.project, name: e.target.value } })}
                className="text-base font-semibold border-0 p-0 h-auto w-40 focus-visible:ring-0" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={handleExport}><Download className="w-4 h-4 mr-1" />导出</Button>
              <Button size="sm" className="h-8 text-sm" onClick={handleSave} disabled={isSaving}><Save className="w-4 h-4 mr-1" />{isSaving ? '保存中' : '保存'}</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-4">
          {/* 项目设置 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50"><CardTitle className="text-lg font-bold text-gray-800">项目设置</CardTitle></CardHeader>
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500 w-12">类型</span>
                <div className="flex gap-4">
                  {PROJECT_TYPES.map(type => (
                    <label key={type.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="projectType"
                        checked={projectData.project.type === type.value}
                        onChange={() => {
                          let newTripDays = coreConfig.tripDays;
                          let newAccommodationDays = coreConfig.accommodationDays;
                          if (type.value === 'half-day' || type.value === 'one-day') { newTripDays = 1; newAccommodationDays = 0; }
                          updateData({ project: { ...projectData.project, type: type.value }, coreConfig: { ...coreConfig, tripDays: newTripDays, accommodationDays: newAccommodationDays } });
                        }}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <span className={`${projectData.project.type === type.value ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{type.label}</span>
                    </label>
                  ))}
                </div>
                {projectData.project.type === 'multi-day' && (
                  <>
                    <span className="text-gray-500 w-12 ml-4">天数</span>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.tripDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, tripDays: v, accommodationDays: v > 0 ? Math.min(coreConfig.accommodationDays, v) : 0 } })} />
                      <span className="text-gray-500">天</span>
                    </div>
                    <span className="text-gray-500 w-12">住宿</span>
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={coreConfig.accommodationDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, accommodationDays: v } })} />
                      <span className="text-gray-500">晚</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

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
                    <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={member.dailyFee} onChange={(v) => {
                      updateStaffMember(member.id, { dailyFee: v });
                      // 同步更新每日费用中的参考薪资
                      const newDailyExpenses = dailyExpenses.map(day => ({
                        ...day,
                        staffFees: { ...day.staffFees, [member.id]: v }
                      }));
                      updateData({ dailyExpenses: newDailyExpenses });
                    }} />
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
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 items-center text-sm">
                          <span className="text-gray-700 font-medium">中餐</span>
                          <Input placeholder="餐厅名称（可选）" className="h-8 text-sm px-3" value={lunch.restaurantName || ''} onChange={(e) => updateMeal('lunch', { restaurantName: e.target.value })} />
                          <span></span>
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
                              <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={lunch.pricePerPerson || coreConfig.mealStandardClient} onChange={(v) => updateMeal('lunch', { pricePerPerson: v })} />
                              <span className="text-gray-500 whitespace-nowrap">元/人</span>
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
                      </div>

                      {/* 晚餐 - 餐厅名优先 */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 items-center text-sm">
                          <span className="text-gray-700 font-medium">晚餐</span>
                          <Input placeholder="餐厅名称（可选）" className="h-8 text-sm px-3" value={dinner.restaurantName || ''} onChange={(e) => updateMeal('dinner', { restaurantName: e.target.value })} />
                          <span></span>
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
                              <NumberInput className="h-8 w-16 text-sm px-2 border rounded" value={dinner.pricePerPerson || coreConfig.mealStandardClient} onChange={(v) => updateMeal('dinner', { pricePerPerson: v })} />
                              <span className="text-gray-500 whitespace-nowrap">元/人</span>
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
                    <Input placeholder="备注" className="h-8 w-32 text-sm px-2" value={item.remark} onChange={(e) => updateOtherExpense(item.id, { remark: e.target.value })} />
                    <div className="flex items-center gap-1">
                      <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={item.amount} onChange={(v) => updateOtherExpense(item.id, { amount: v })} />
                      <span className="text-gray-500">元</span>
                    </div>
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
        <div className="w-96 flex-shrink-0 space-y-4 sticky top-14 self-start">
          {/* 模式切换 */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'project' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setViewMode('project')}
            >
              <LayoutGrid className="w-4 h-4" />
              按项目
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setViewMode('daily')}
            >
              <Calendar className="w-4 h-4" />
              按日期
            </button>
          </div>

          {/* 成本表 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50">
              <CardTitle className="text-lg font-bold text-gray-800">成本核算表</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">内部参考</p>
            </CardHeader>
            <CardContent className="py-3 px-4 max-h-[60vh] overflow-y-auto">
              {viewMode === 'project' ? (
                /* 按项目模式 - 带明细 */
                <div className="space-y-3 text-sm">
                  {/* 住宿费明细 */}
                  {projectData.project.type === 'multi-day' && (summary.totalAccommodation > 0 || (coreConfig.twinRoom?.price || 0) > 0 || (coreConfig.kingRoom?.price || 0) > 0) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>住宿费</span>
                        <span className="font-bold">{formatMoney(summary.totalAccommodation)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {(coreConfig.twinRoom?.price || 0) > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">双床房 {coreConfig.twinRoom?.price}元 × {(coreConfig.twinRoom?.countClient || 0) + (coreConfig.twinRoom?.countStaff || 0)}间</span>
                            <span>{formatMoney((coreConfig.twinRoom?.price || 0) * ((coreConfig.twinRoom?.countClient || 0) + (coreConfig.twinRoom?.countStaff || 0)))}</span>
                          </div>
                        )}
                        {(coreConfig.kingRoom?.price || 0) > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">大床房 {coreConfig.kingRoom?.price}元 × {(coreConfig.kingRoom?.countClient || 0) + (coreConfig.kingRoom?.countStaff || 0)}间</span>
                            <span>{formatMoney((coreConfig.kingRoom?.price || 0) * ((coreConfig.kingRoom?.countClient || 0) + (coreConfig.kingRoom?.countStaff || 0)))}</span>
                          </div>
                        )}
                        {coreConfig.staffAccommodation && (coreConfig.staffRoomPrice || 0) > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">工作人员 {coreConfig.staffRoomType === 'twin' ? '双床' : '大床'} {coreConfig.staffRoomPrice}元 × {coreConfig.staffAccommodationNights}晚</span>
                            <span>{formatMoney((coreConfig.staffRoomPrice || 0) * (coreConfig.staffAccommodationNights || 0))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 用餐费明细 */}
                  {summary.totalMeal > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>用餐费</span>
                        <span className="font-bold">{formatMoney(summary.totalMeal)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {safeDailyExpenses.map((day, idx) => {
                          const lunchAmount = day.lunch.amount || (day.lunch.pricePerPerson * (day.lunch.clientMealType === 'table' ? day.lunch.tableCount * 10 : day.lunch.clientCount));
                          const dinnerAmount = day.dinner.amount || (day.dinner.pricePerPerson * (day.dinner.clientMealType === 'table' ? day.dinner.tableCount * 10 : day.dinner.clientCount));
                          if (lunchAmount <= 0 && dinnerAmount <= 0) return null;
                          return (
                            <div key={idx} className="px-3 py-1.5">
                              <div className="flex justify-between mb-1">
                                <span className="text-gray-600">第{day.day}天</span>
                              </div>
                              {lunchAmount > 0 && (
                                <div className="flex justify-between pl-2">
                                  <span className="text-gray-500">中餐 {day.lunch.restaurantName && `(${day.lunch.restaurantName})`}</span>
                                  <span>{formatMoney(lunchAmount)}</span>
                                </div>
                              )}
                              {dinnerAmount > 0 && (
                                <div className="flex justify-between pl-2">
                                  <span className="text-gray-500">晚餐 {day.dinner.restaurantName && `(${day.dinner.restaurantName})`}</span>
                                  <span>{formatMoney(dinnerAmount)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 交通费明细 */}
                  {(summary.totalBus > 0 || (coreConfig.otherTransports && coreConfig.otherTransports.length > 0)) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>交通费</span>
                        <span className="font-bold">{formatMoney(summary.totalBus)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {coreConfig.busFee > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">大巴包车</span>
                            <span>{formatMoney(coreConfig.busFee)}</span>
                          </div>
                        )}
                        {safeOtherTransports.map(t => (
                          <div key={t.id} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">{t.type === 'flight' ? '飞机' : '高铁'} {t.price}元 × {t.count}张</span>
                            <span>{formatMoney(t.price * t.count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 工作人员明细 */}
                  {summary.totalStaffFee > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>工作人员</span>
                        <span className="font-bold">{formatMoney(summary.totalStaffFee)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {safeStaffMembers.filter(m => m.count > 0).map(member => {
                          const totalFee = member.count * member.dailyFee * coreConfig.tripDays;
                          return (
                            <div key={member.id} className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">{member.name} {member.count}人 × {member.dailyFee}元/天 × {coreConfig.tripDays}天</span>
                              <span>{formatMoney(totalFee)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 活动项目明细 */}
                  {summary.totalSingleItems > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>活动项目</span>
                        <span className="font-bold">{formatMoney(summary.totalSingleItems)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {safeDailyExpenses.map((day, idx) => 
                          day.singleItems.filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).map((item, iidx) => (
                            <div key={`${idx}-${iidx}`} className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">{item.name} {item.price}元/{item.unit} × {item.count}{item.unit}</span>
                              <span>{formatMoney(item.totalPrice || item.price * item.count)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* 其他费用明细 */}
                  {summary.totalOtherExpenses > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>其他费用</span>
                        <span className="font-bold">{formatMoney(summary.totalOtherExpenses)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {safeInsurance.totalAmount > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">保险 {otherExpenses.insurance.pricePerPerson}元/人/天 × {otherExpenses.insurance.days}天 × {totalClients + totalStaff}人</span>
                            <span>{formatMoney(safeInsurance.totalAmount)}</span>
                          </div>
                        )}
                        {safeMaterials.filter(m => (m.totalPrice || m.price * m.quantity) > 0).map(m => (
                          <div key={m.id} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">杂费(客户) {m.name} {m.price}元 × {m.quantity}</span>
                            <span>{formatMoney(m.totalPrice || m.price * m.quantity)}</span>
                          </div>
                        ))}
                        {safeOtherExpensesList.filter(o => o.amount > 0).map(o => (
                          <div key={o.id} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">杂费(工作人员) {o.remark}</span>
                            <span>{formatMoney(o.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between py-2.5 bg-gray-100 rounded mt-2 px-3">
                    <span className="font-semibold text-gray-800">总成本</span>
                    <span className="font-bold text-gray-900 text-xl">{formatMoney(summary.totalCost)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-gray-500">
                    <span>人均成本</span>
                    <span className="font-medium text-gray-700">{formatMoney(summary.avgCostPerClient)}</span>
                  </div>
                </div>
              ) : (
                /* 按日期模式 */
                <div className="space-y-3 text-sm">
                  {safeDailyExpenses.map((day, idx) => {
                    const dayAccommodation = projectData.project.type === 'multi-day' ? day.accommodation : 0;
                    const dayLunch = day.lunch.amount || (day.lunch.pricePerPerson * (day.lunch.clientMealType === 'table' ? day.lunch.tableCount * 10 : day.lunch.clientCount));
                    const dayDinner = day.dinner.amount || (day.dinner.pricePerPerson * (day.dinner.clientMealType === 'table' ? day.dinner.tableCount * 10 : day.dinner.clientCount));
                    const dayStaffFee = Object.values(day.staffFees || {}).reduce((s, f) => s + (f || 0), 0);
                    const daySingleItems = day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0);
                    const dayTotal = dayAccommodation + dayLunch + dayDinner + dayStaffFee + daySingleItems;
                    
                    return (
                      <div key={idx} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                          <span>第{day.day}天</span>
                          <span className="font-bold">{formatMoney(dayTotal)}</span>
                        </div>
                        <div className="divide-y text-xs">
                          {dayAccommodation > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">住宿</span>
                              <span>{formatMoney(dayAccommodation)}</span>
                            </div>
                          )}
                          {dayLunch > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">中餐{day.lunch.restaurantName && ` (${day.lunch.restaurantName})`}</span>
                              <span>{formatMoney(dayLunch)}</span>
                            </div>
                          )}
                          {dayDinner > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">晚餐{day.dinner.restaurantName && ` (${day.dinner.restaurantName})`}</span>
                              <span>{formatMoney(dayDinner)}</span>
                            </div>
                          )}
                          {dayStaffFee > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">工作人员</span>
                              <span>{formatMoney(dayStaffFee)}</span>
                            </div>
                          )}
                          {day.singleItems.filter(i => (i.totalPrice || i.price * i.count) > 0).map((item, iidx) => (
                            <div key={iidx} className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">{item.name || '活动'}</span>
                              <span>{formatMoney(item.totalPrice || item.price * item.count)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 其他费用（不属于具体某天） */}
                  {summary.totalOtherExpenses > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>其他费用</span>
                        <span className="font-bold">{formatMoney(summary.totalOtherExpenses)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {safeInsurance.totalAmount > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">保险</span>
                            <span>{formatMoney(safeInsurance.totalAmount)}</span>
                          </div>
                        )}
                        {safeMaterials.filter(m => (m.totalPrice || m.price * m.quantity) > 0).map(m => (
                          <div key={m.id} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">{m.name || '杂费(客户)'}</span>
                            <span>{formatMoney(m.totalPrice || m.price * m.quantity)}</span>
                          </div>
                        ))}
                        {safeOtherExpensesList.filter(o => o.amount > 0).map(o => (
                          <div key={o.id} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">{o.remark || '杂费(工作人员)'}</span>
                            <span>{formatMoney(o.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 交通费（不属于具体某天） */}
                  {summary.totalBus > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>交通费</span>
                        <span className="font-bold">{formatMoney(summary.totalBus)}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {coreConfig.busFee > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">大巴</span>
                            <span>{formatMoney(coreConfig.busFee)}</span>
                          </div>
                        )}
                        {safeOtherTransports.map(t => (
                          <div key={t.id} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">{t.type === 'flight' ? '飞机' : '高铁'}</span>
                            <span>{formatMoney(t.price * t.count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between py-2.5 bg-gray-100 rounded mt-2 px-3">
                    <span className="font-semibold text-gray-800">总成本</span>
                    <span className="font-bold text-gray-900 text-xl">{formatMoney(summary.totalCost)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-gray-500">
                    <span>人均成本</span>
                    <span className="font-medium text-gray-700">{formatMoney(summary.avgCostPerClient)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 报价单 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50">
              <CardTitle className="text-lg font-bold text-gray-800">报价单</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">给客户展示</p>
            </CardHeader>
            <CardContent className="py-3 px-4 max-h-[50vh] overflow-y-auto">
              {viewMode === 'project' ? (
                /* 按项目模式 */
                <div className="space-y-0 text-sm">
                  {projectData.project.type === 'multi-day' && summary.totalAccommodation > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">住宿费</span>
                      <span className="font-medium">{formatMoney(summary.totalAccommodation)}</span>
                    </div>
                  )}
                  {summary.totalMeal > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">用餐费</span>
                      <span className="font-medium">{formatMoney(summary.totalMeal)}</span>
                    </div>
                  )}
                  {summary.totalBus > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">交通费</span>
                      <span className="font-medium">{formatMoney(summary.totalBus)}</span>
                    </div>
                  )}
                  {safeDailyExpenses.flatMap(d => d.singleItems).filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium">{formatMoney(item.totalPrice || item.price * item.count)}</span>
                    </div>
                  ))}
                  {safeInsurance.totalAmount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">保险费</span>
                      <span className="font-medium">{formatMoney(otherExpenses.insurance.totalAmount)}</span>
                    </div>
                  )}
                  {otherExpenses.materials.filter(m => (m.totalPrice || m.price * m.quantity) > 0).map((m, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">{m.name || `项目${idx + 1}`}</span>
                      <span className="font-medium">{formatMoney(m.totalPrice || m.price * m.quantity)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                /* 按日期模式 */
                <div className="space-y-3 text-sm">
                  {safeDailyExpenses.map((day, idx) => {
                    const dayAccommodation = projectData.project.type === 'multi-day' ? day.accommodation : 0;
                    const dayLunch = day.lunch.amount || (day.lunch.pricePerPerson * (day.lunch.clientMealType === 'table' ? day.lunch.tableCount * 10 : day.lunch.clientCount));
                    const dayDinner = day.dinner.amount || (day.dinner.pricePerPerson * (day.dinner.clientMealType === 'table' ? day.dinner.tableCount * 10 : day.dinner.clientCount));
                    const daySingleItems = day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0);
                    const dayTotal = dayAccommodation + dayLunch + dayDinner + daySingleItems;
                    if (dayTotal <= 0) return null;
                    
                    return (
                      <div key={idx} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                          <span>第{day.day}天</span>
                          <span className="font-bold">{formatMoney(dayTotal)}</span>
                        </div>
                        <div className="divide-y text-xs">
                          {dayAccommodation > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">住宿</span>
                              <span>{formatMoney(dayAccommodation)}</span>
                            </div>
                          )}
                          {dayLunch > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">中餐</span>
                              <span>{formatMoney(dayLunch)}</span>
                            </div>
                          )}
                          {dayDinner > 0 && (
                            <div className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">晚餐</span>
                              <span>{formatMoney(dayDinner)}</span>
                            </div>
                          )}
                          {day.singleItems.filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).map((item, iidx) => (
                            <div key={iidx} className="px-3 py-1.5 flex justify-between">
                              <span className="text-gray-600">{item.name}</span>
                              <span>{formatMoney(item.totalPrice || item.price * item.count)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 其他费用 */}
                  {(safeInsurance.totalAmount > 0 || safeMaterials.some(m => (m.totalPrice || m.price * m.quantity) > 0)) && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 font-medium flex justify-between items-center">
                        <span>其他费用</span>
                        <span className="font-bold">{formatMoney(safeInsurance.totalAmount + safeMaterials.reduce((s, m) => s + (m.totalPrice || m.price * m.quantity), 0))}</span>
                      </div>
                      <div className="divide-y text-xs">
                        {safeInsurance.totalAmount > 0 && (
                          <div className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">保险费</span>
                            <span>{formatMoney(safeInsurance.totalAmount)}</span>
                          </div>
                        )}
                        {safeMaterials.filter(m => (m.totalPrice || m.price * m.quantity) > 0).map((m, idx) => (
                          <div key={idx} className="px-3 py-1.5 flex justify-between">
                            <span className="text-gray-600">{m.name || `项目${idx + 1}`}</span>
                            <span>{formatMoney(m.totalPrice || m.price * m.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 底部计算部分 */}
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between py-2 bg-gray-50 rounded px-2">
                  <span className="text-gray-600">小计</span>
                  <span className="font-medium">{formatMoney(summary.totalCost)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">服务费 ({otherExpenses.serviceFeePercent}%)</span>
                  <span className="font-medium">{formatMoney(serviceFee)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">税费 (6%)</span>
                  <span className="font-medium">{formatMoney(tax)}</span>
                </div>
                <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3">
                  <span className="font-semibold text-gray-800">报价合计</span>
                  <span className="font-bold text-gray-900 text-xl">{formatMoney(totalPrice)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">优惠</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">-</span>
                    <NumberInput className="h-8 w-20 text-sm px-2 text-right border rounded" value={discount} onChange={(v) => setDiscount(v)} />
                  </div>
                </div>
                <div className="flex justify-between py-2.5 bg-gray-100 rounded mt-2 px-3">
                  <span className="font-bold text-gray-800">应付金额</span>
                  <span className="font-bold text-gray-900 text-2xl">{formatMoney(finalPrice)}</span>
                </div>
                <div className="flex justify-between py-2 text-gray-500">
                  <span>人均费用</span>
                  <span className="font-medium text-gray-700">{formatMoney(pricePerClient)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 人员统计 */}
          <Card>
            <CardHeader className="py-2 px-4 border-b bg-gray-50"><CardTitle className="text-lg font-bold text-gray-800">人员统计</CardTitle></CardHeader>
            <CardContent className="py-3 px-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="border rounded-lg p-3 text-center"><div className="text-xl font-bold text-gray-800">{totalClients}</div><div className="text-gray-500 mt-1">客户人数</div></div>
                <div className="border rounded-lg p-3 text-center"><div className="text-xl font-bold text-gray-800">{totalStaff}</div><div className="text-gray-500 mt-1">工作人员</div></div>
                <div className="border rounded-lg p-3 text-center"><div className="text-xl font-bold text-gray-800">{totalPeople}</div><div className="text-gray-500 mt-1">总人数</div></div>
                <div className="border rounded-lg p-3 text-center"><div className="text-xl font-bold text-gray-800">{projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${coreConfig.tripDays}天`}</div><div className="text-gray-500 mt-1">行程类型</div></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
