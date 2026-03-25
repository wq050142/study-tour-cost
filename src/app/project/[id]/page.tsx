'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, Plus, Trash2 } from 'lucide-react';
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
    const summary = calculateCostSummary(projectData);
    const serviceFee = calculateServiceFee(summary.totalCost, otherExpenses.serviceFeePercent);
    const tax = (summary.totalCost + serviceFee) * 0.06;
    const totalPrice = summary.totalCost + serviceFee + tax;
    const finalPrice = totalPrice - discount;
    
    const projectTypeLabel = projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${coreConfig.tripDays}天`;
    
    const lines = ['═'.repeat(50), '研学旅行报价单', '═'.repeat(50),
      `项目名称：${projectData.project.name}`,
      `行程类型：${projectTypeLabel}`,
      `客户人数：${summary.totalClients}人`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '', '─'.repeat(50), '费用明细', '─'.repeat(50),
    ];
    
    if (summary.totalAccommodation > 0) lines.push(`住宿费用：${formatMoney(summary.totalAccommodation)}`);
    if (summary.totalMeal > 0) lines.push(`用餐费用：${formatMoney(summary.totalMeal)}`);
    if (summary.totalBus > 0) lines.push(`交通费用：${formatMoney(summary.totalBus)}`);
    if (summary.totalSingleItems > 0) lines.push(`活动费用：${formatMoney(summary.totalSingleItems)}`);
    if (otherExpenses.insurance.totalAmount > 0) lines.push(`保险费用：${formatMoney(otherExpenses.insurance.totalAmount)}`);
    if (otherExpenses.materials.length > 0) {
      const materialsTotal = otherExpenses.materials.reduce((s, m) => s + (m.totalPrice || m.price * m.quantity), 0);
      lines.push(`物料费用：${formatMoney(materialsTotal)}`);
    }
    
    lines.push('', '─'.repeat(50), `小计：${formatMoney(summary.totalCost)}`, 
      `服务费(${otherExpenses.serviceFeePercent}%)：${formatMoney(serviceFee)}`, 
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
  const totalStaff = coreConfig.staffMembers.reduce((sum, m) => sum + m.count, 0);
  const totalPeople = totalClients + totalStaff;

  // 确保工作人员列表存在
  if (!coreConfig.staffMembers || coreConfig.staffMembers.length === 0) {
    coreConfig.staffMembers = [...DEFAULT_STAFF_MEMBERS];
  }
  
  // 确保其他费用格式正确
  if (!otherExpenses.insurance || typeof otherExpenses.insurance !== 'object') {
    otherExpenses.insurance = { ...DEFAULT_INSURANCE_CONFIG, days: coreConfig.tripDays };
  }
  if (!otherExpenses.materials) otherExpenses.materials = [];
  if (!otherExpenses.otherExpenses) otherExpenses.otherExpenses = [];

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
            <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base font-semibold">项目设置</CardTitle></CardHeader>
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
            <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base font-semibold">客户配置 <span className="text-blue-600 font-normal text-sm">共{totalClients}人</span></CardTitle></CardHeader>
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
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-base font-semibold">人员及大交通 <span className="text-green-600 font-normal text-sm">共{totalStaff}人</span></CardTitle>
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500 w-12">交通</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">大巴费</span>
                  <NumberInput className="h-8 w-24 text-sm px-2 border rounded" value={coreConfig.busFee} onChange={(v) => updateData({ coreConfig: { ...coreConfig, busFee: v } })} />
                  <span className="text-gray-500">元</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 每日费用 */}
          <Card>
            <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base font-semibold">{projectData.project.type === 'half-day' ? '费用明细' : '每日费用'}</CardTitle></CardHeader>
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
                    const clientMealType = mealConfig.clientMealType || 'individual';
                    const clientAmount = clientMealType === 'table'
                      ? (coreConfig.mealStandardClient || 0) * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
                      : (coreConfig.mealStandardClient || 0) * totalClients;
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
                        <span className="text-base font-medium text-gray-800">{projectData.project.type === 'half-day' ? '费用明细' : `第${day.day}天`}</span>
                        <span className="text-base font-semibold text-gray-900">¥{dayTotal.toFixed(0)}</span>
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
                              <input type="radio" name={`lunch-client-${day.day}`} checked={lunch.clientMealType === 'individual'} onChange={() => updateMeal('lunch', { clientMealType: 'individual', tableCount: 0, pricePerPerson: lunch.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                              <span>例餐</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`lunch-client-${day.day}`} checked={(lunch.clientMealType || 'table') === 'table'} onChange={() => updateMeal('lunch', { clientMealType: 'table', tableCount: lunch.tableCount || Math.ceil(totalClients / 10), pricePerPerson: lunch.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                              <span>桌餐</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={lunch.pricePerPerson || coreConfig.mealStandardClient} onChange={(v) => updateMeal('lunch', { pricePerPerson: v })} />
                              <span className="text-gray-500 whitespace-nowrap">元/人</span>
                            </div>
                            {(lunch.clientMealType || 'table') === 'table' && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400">×</span>
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
                              <input type="radio" name={`dinner-client-${day.day}`} checked={dinner.clientMealType === 'individual'} onChange={() => updateMeal('dinner', { clientMealType: 'individual', tableCount: 0, pricePerPerson: dinner.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                              <span>例餐</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`dinner-client-${day.day}`} checked={(dinner.clientMealType || 'table') === 'table'} onChange={() => updateMeal('dinner', { clientMealType: 'table', tableCount: dinner.tableCount || Math.ceil(totalClients / 10), pricePerPerson: dinner.pricePerPerson || coreConfig.mealStandardClient })} className="w-4 h-4" />
                              <span>桌餐</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <NumberInput className="h-8 w-20 text-sm px-2 border rounded" value={dinner.pricePerPerson || coreConfig.mealStandardClient} onChange={(v) => updateMeal('dinner', { pricePerPerson: v })} />
                              <span className="text-gray-500 whitespace-nowrap">元/人</span>
                            </div>
                            {(dinner.clientMealType || 'table') === 'table' && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400">×</span>
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
            <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base font-semibold">其他费用</CardTitle></CardHeader>
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

              {/* 物料费 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">物料费</span>
                  <Button variant="outline" size="sm" className="h-7 text-sm" onClick={addMaterial}><Plus className="w-4 h-4 mr-1" />添加</Button>
                </div>
                {otherExpenses.materials.map((material) => (
                  <div key={material.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <Input placeholder="物料名称" className="h-8 w-32 text-sm px-2" value={material.name} onChange={(e) => updateMaterial(material.id, { name: e.target.value })} />
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

              {/* 其他费用 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">其他</span>
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
        <div className="w-80 flex-shrink-0 space-y-4 sticky top-14 self-start">
          {/* 成本表 */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-base font-semibold">成本核算表</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">内部参考</p>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <div className="space-y-0 text-sm">
                {projectData.project.type === 'multi-day' && <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">住宿费</span><span className="font-medium">{formatMoney(summary.totalAccommodation)}</span></div>}
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">用餐费</span><span className="font-medium">{formatMoney(summary.totalMeal)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">交通费</span><span className="font-medium">{formatMoney(summary.totalBus)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">工作人员</span><span className="font-medium">{formatMoney(summary.totalStaffFee)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">单项费用</span><span className="font-medium">{formatMoney(summary.totalSingleItems)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">其他费用</span><span className="font-medium">{formatMoney(summary.totalOtherExpenses)}</span></div>
                <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3"><span className="font-semibold text-gray-800">总成本</span><span className="font-bold text-gray-900 text-xl">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between py-2 text-gray-500"><span>人均成本</span><span className="font-medium text-gray-700">{formatMoney(summary.avgCostPerClient)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 报价单 */}
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-base font-semibold">报价单</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">给客户展示</p>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <div className="space-y-0 text-sm">
                {projectData.project.type === 'multi-day' && summary.totalAccommodation > 0 && <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">住宿费</span><span className="font-medium">{formatMoney(summary.totalAccommodation)}</span></div>}
                {summary.totalMeal > 0 && <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">用餐费</span><span className="font-medium">{formatMoney(summary.totalMeal)}</span></div>}
                {summary.totalBus > 0 && <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">交通费</span><span className="font-medium">{formatMoney(summary.totalBus)}</span></div>}
                {dailyExpenses.flatMap(d => d.singleItems).filter(i => i.name && (i.totalPrice || i.price * i.count) > 0).map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">{item.name}</span><span className="font-medium">{formatMoney(item.totalPrice || item.price * item.count)}</span></div>
                ))}
                {otherExpenses.insurance.totalAmount > 0 && <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">保险费</span><span className="font-medium">{formatMoney(otherExpenses.insurance.totalAmount)}</span></div>}
                {otherExpenses.materials.filter(m => m.totalPrice > 0 || m.price * m.quantity > 0).map((m, idx) => (
                  <div key={idx} className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">{m.name || `物料${idx + 1}`}</span><span className="font-medium">{formatMoney(m.totalPrice || m.price * m.quantity)}</span></div>
                ))}
                <div className="flex justify-between py-2 bg-gray-50 rounded px-2 mt-2"><span className="text-gray-600">小计</span><span className="font-medium">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">服务费 ({otherExpenses.serviceFeePercent}%)</span><span className="font-medium">{formatMoney(serviceFee)}</span></div>
                <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-gray-600">税费 (6%)</span><span className="font-medium">{formatMoney(tax)}</span></div>
                <div className="flex justify-between py-2.5 bg-gray-50 rounded mt-2 px-3"><span className="font-semibold text-gray-800">报价合计</span><span className="font-bold text-gray-900 text-xl">{formatMoney(totalPrice)}</span></div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">优惠</span>
                  <div className="flex items-center gap-1"><span className="text-gray-400">-</span><NumberInput className="h-8 w-20 text-sm px-2 text-right border rounded" value={discount} onChange={(v) => setDiscount(v)} /></div>
                </div>
                <div className="flex justify-between py-2.5 bg-gray-100 rounded mt-2 px-3"><span className="font-bold text-gray-800">应付金额</span><span className="font-bold text-gray-900 text-2xl">{formatMoney(finalPrice)}</span></div>
                <div className="flex justify-between py-2 text-gray-500"><span>人均费用</span><span className="font-medium text-gray-700">{formatMoney(pricePerClient)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 人员统计 */}
          <Card>
            <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base font-semibold">人员统计</CardTitle></CardHeader>
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
