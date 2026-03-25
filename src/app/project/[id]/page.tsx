'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NumberInput } from '@/components/number-input';
import { ProjectData, ProjectType, AccommodationType, ClientMealType, StaffMealType, DEFAULT_STAFF_FEES, ACCOMMODATION_TYPE_LABELS, DEFAULT_MEAL_CONFIG } from '@/types';
import { getProjectData, updateProjectData } from '@/lib/storage';
import { calculateCostSummary, formatMoney } from '@/lib/calculation';

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
    if (data) setProjectData(data);
    else { alert('项目不存在'); router.push('/'); }
  }, [id, router]);

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
    const serviceFee = summary.totalCost * 0.1;
    const tax = summary.totalCost * 0.06;
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
    
    if (projectData.project.type === 'multi-day' && summary.totalAccommodation > 0) lines.push(`住宿费用：${formatMoney(summary.totalAccommodation)}`);
    if (summary.totalMeal > 0) lines.push(`用餐费用：${formatMoney(summary.totalMeal)}`);
    if (summary.totalBus > 0) lines.push(`交通费用：${formatMoney(summary.totalBus)}`);
    if (summary.totalSingleItems > 0) lines.push(`活动费用：${formatMoney(summary.totalSingleItems)}`);
    if (projectData.otherExpenses.insurance > 0) lines.push(`保险费用：${formatMoney(projectData.otherExpenses.insurance)}`);
    if (projectData.otherExpenses.materialFee > 0) lines.push(`物料费用：${formatMoney(projectData.otherExpenses.materialFee)}`);
    if (projectData.otherExpenses.giftFee > 0) lines.push(`礼品费用：${formatMoney(projectData.otherExpenses.giftFee)}`);
    
    lines.push('', '─'.repeat(50), `小计：${formatMoney(summary.totalCost)}`, `服务费(10%)：${formatMoney(serviceFee)}`, `税费(6%)：${formatMoney(tax)}`,
      `报价合计：${formatMoney(totalPrice)}`, `优惠：-${formatMoney(discount)}`, '', '═'.repeat(50), `应付金额：${formatMoney(finalPrice)}`, `人均费用：${formatMoney(finalPrice / (summary.totalClients || 1))}`);
    
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
  const totalStaff = coreConfig.staffCounts.guide + coreConfig.staffCounts.photographer + coreConfig.staffCounts.videographer + coreConfig.staffCounts.driver;
  const totalPeople = totalClients + totalStaff;

  // 确保每日数据长度正确，新增天数使用参考薪资
  const defaultStaffFees = coreConfig.staffDailyFees || { guide: 0, photographer: 0, videographer: 0, driver: 0 };
  if (dailyExpenses.length !== coreConfig.tripDays) {
    const newData = Array.from({ length: coreConfig.tripDays }, (_, i) => 
      dailyExpenses[i] || { day: i + 1, accommodation: 0, meal: 0, staffFees: { ...defaultStaffFees }, singleItems: [], teamExpenses: 0 }
    );
    updateData({ dailyExpenses: newData });
  }

  const numInput = "h-7 w-14 text-xs px-1.5";
  const numInputMid = "h-7 w-20 text-xs px-1.5";

  const serviceFee = summary.totalCost * 0.1;
  const tax = summary.totalCost * 0.06;
  const totalPrice = summary.totalCost + serviceFee + tax;
  const finalPrice = totalPrice - discount;
  const pricePerClient = totalClients > 0 ? finalPrice / totalClients : 0;

  const allSingleItems: { name: string; totalPrice: number }[] = [];
  dailyExpenses.forEach(day => {
    day.singleItems.forEach(item => {
      if (item.name && (item.totalPrice || item.price * item.count) > 0) {
        allSingleItems.push({ name: item.name, totalPrice: item.totalPrice || item.price * item.count });
      }
    });
  });

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
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExport}><Download className="w-3 h-3 mr-1" />导出</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}><Save className="w-3 h-3 mr-1" />{isSaving ? '保存中' : '保存'}</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex gap-4 p-4">
        <div className="flex-1 min-w-0 space-y-3">
          {/* 项目设置 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">项目设置</CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              <div className="flex items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-10">类型</span>
                <div className="flex gap-3">
                  {PROJECT_TYPES.map(type => (
                    <label key={type.value} className="flex items-center gap-1 cursor-pointer">
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
                        className="w-3.5 h-3.5 accent-blue-500"
                      />
                      <span className={`${projectData.project.type === type.value ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{type.label}</span>
                    </label>
                  ))}
                </div>
                {projectData.project.type === 'multi-day' && (
                  <>
                    <span className="text-gray-500 w-10 ml-2">天数</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInput} value={coreConfig.tripDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, tripDays: v, accommodationDays: v > 0 ? Math.min(coreConfig.accommodationDays, v) : 0 } })} />
                      <span className="text-gray-400 w-4">天</span>
                    </div>
                    <span className="text-gray-500 w-10">住宿</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInput} value={coreConfig.accommodationDays} onChange={(v) => updateData({ coreConfig: { ...coreConfig, accommodationDays: v } })} />
                      <span className="text-gray-400 w-4">晚</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 客户配置 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">客户配置 <span className="text-blue-600 font-normal">共{totalClients}人</span></CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-12">人员:</span>
                <span className="text-gray-400">学生</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.studentCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, studentCount: v } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">老师</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.teacherCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, teacherCount: v } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">家长</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.parentCount} onChange={(v) => updateData({ coreConfig: { ...coreConfig, parentCount: v } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
              </div>
              <Separator className="my-1" />

              {projectData.project.type === 'multi-day' && (
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="text-gray-500 w-12">住宿:</span>
                    <span className="text-gray-400">标准</span>
                    <div className="flex gap-2">
                      {(Object.keys(ACCOMMODATION_TYPE_LABELS) as AccommodationType[]).map(type => (
                        <label key={type} className="flex items-center gap-0.5 cursor-pointer">
                          <input
                            type="radio"
                            name="accommodationType"
                            checked={(coreConfig.accommodationType || '3-diamond') === type}
                            onChange={() => updateData({ coreConfig: { ...coreConfig, accommodationType: type } })}
                            className="w-3 h-3 accent-blue-500"
                          />
                          <span className={`${(coreConfig.accommodationType || '3-diamond') === type ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{ACCOMMODATION_TYPE_LABELS[type]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs pl-14">
                    <span className="text-gray-400 w-12">双床房</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInput} value={coreConfig.twinRoom?.countClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, twinRoom: { ...coreConfig.twinRoom, countClient: v, price: coreConfig.twinRoom?.price || 0, countStaff: coreConfig.twinRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-400 w-4">间</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInputMid} value={coreConfig.twinRoom?.price || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, twinRoom: { ...coreConfig.twinRoom, price: v, countClient: coreConfig.twinRoom?.countClient || 0, countStaff: coreConfig.twinRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-400 w-6">元/间</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs pl-14">
                    <span className="text-gray-400 w-12">大床房</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInput} value={coreConfig.kingRoom?.countClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, kingRoom: { ...coreConfig.kingRoom, countClient: v, price: coreConfig.kingRoom?.price || 0, countStaff: coreConfig.kingRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-400 w-4">间</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInputMid} value={coreConfig.kingRoom?.price || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, kingRoom: { ...coreConfig.kingRoom, price: v, countClient: coreConfig.kingRoom?.countClient || 0, countStaff: coreConfig.kingRoom?.countStaff || 0 } } })} />
                      <span className="text-gray-400 w-6">元/间</span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-12">用餐:</span>
                <span className="text-gray-400">餐标</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInputMid} value={coreConfig.mealStandardClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardClient: v } })} />
                  <span className="text-gray-400 w-4">元/人</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 工作人员配置 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">工作人员配置 <span className="text-green-600 font-normal">共{totalStaff}人</span></CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-12">人员:</span>
                <span className="text-gray-400">导游</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.staffCounts.guide} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, guide: v } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">摄影</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.staffCounts.photographer} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, photographer: v } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">摄像</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.staffCounts.videographer} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, videographer: v } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">司机</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.staffCounts.driver} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, driver: v } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
              </div>
              
              {/* 工作人员日薪资参考 - 不包含司机 */}
              {(coreConfig.staffCounts.guide > 0 || coreConfig.staffCounts.photographer > 0 || coreConfig.staffCounts.videographer > 0) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-gray-500 w-12">日薪资:</span>
                  {coreConfig.staffCounts.guide > 0 && (
                    <>
                      <span className="text-gray-400">导游</span>
                      <div className="flex items-center gap-0.5">
                        <NumberInput className={numInputMid} value={coreConfig.staffDailyFees?.guide || 0} onChange={(v) => {
                          const newDailyFees = { ...(coreConfig.staffDailyFees || { guide: 0, photographer: 0, videographer: 0, driver: 0 }), guide: v };
                          const newDailyExpenses = dailyExpenses.map(day => ({ ...day, staffFees: { ...day.staffFees, guide: v } }));
                          updateData({ coreConfig: { ...coreConfig, staffDailyFees: newDailyFees }, dailyExpenses: newDailyExpenses });
                        }} />
                        <span className="text-gray-400 w-6">元</span>
                      </div>
                    </>
                  )}
                  {coreConfig.staffCounts.photographer > 0 && (
                    <>
                      <span className="text-gray-400">摄影</span>
                      <div className="flex items-center gap-0.5">
                        <NumberInput className={numInputMid} value={coreConfig.staffDailyFees?.photographer || 0} onChange={(v) => {
                          const newDailyFees = { ...(coreConfig.staffDailyFees || { guide: 0, photographer: 0, videographer: 0, driver: 0 }), photographer: v };
                          const newDailyExpenses = dailyExpenses.map(day => ({ ...day, staffFees: { ...day.staffFees, photographer: v } }));
                          updateData({ coreConfig: { ...coreConfig, staffDailyFees: newDailyFees }, dailyExpenses: newDailyExpenses });
                        }} />
                        <span className="text-gray-400 w-6">元</span>
                      </div>
                    </>
                  )}
                  {coreConfig.staffCounts.videographer > 0 && (
                    <>
                      <span className="text-gray-400">摄像</span>
                      <div className="flex items-center gap-0.5">
                        <NumberInput className={numInputMid} value={coreConfig.staffDailyFees?.videographer || 0} onChange={(v) => {
                          const newDailyFees = { ...(coreConfig.staffDailyFees || { guide: 0, photographer: 0, videographer: 0, driver: 0 }), videographer: v };
                          const newDailyExpenses = dailyExpenses.map(day => ({ ...day, staffFees: { ...day.staffFees, videographer: v } }));
                          updateData({ coreConfig: { ...coreConfig, staffDailyFees: newDailyFees }, dailyExpenses: newDailyExpenses });
                        }} />
                        <span className="text-gray-400 w-6">元</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              <Separator className="my-1" />

              {projectData.project.type === 'multi-day' && (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="text-gray-500 w-12">住宿:</span>
                    <label className="flex items-center gap-0.5 cursor-pointer">
                      <input type="radio" name="staffAccommodation" checked={coreConfig.staffAccommodation === true} onChange={() => updateData({ coreConfig: { ...coreConfig, staffAccommodation: true } })} className="w-3 h-3 accent-blue-500" />
                      <span className="text-[11px]">是</span>
                    </label>
                    <label className="flex items-center gap-0.5 cursor-pointer">
                      <input type="radio" name="staffAccommodation" checked={coreConfig.staffAccommodation === false} onChange={() => updateData({ coreConfig: { ...coreConfig, staffAccommodation: false } })} className="w-3 h-3 accent-blue-500" />
                      <span className="text-[11px]">否</span>
                    </label>
                  </div>
                  {coreConfig.staffAccommodation && (
                    <>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs pl-14">
                        <span className="text-gray-400">床型</span>
                        <label className="flex items-center gap-0.5 cursor-pointer">
                          <input type="radio" name="staffRoomType" checked={(coreConfig.staffRoomType || 'twin') === 'twin'} onChange={() => updateData({ coreConfig: { ...coreConfig, staffRoomType: 'twin' } })} className="w-2.5 h-2.5 accent-blue-500" />
                          <span className="text-[10px]">双床</span>
                        </label>
                        <label className="flex items-center gap-0.5 cursor-pointer">
                          <input type="radio" name="staffRoomType" checked={coreConfig.staffRoomType === 'king'} onChange={() => updateData({ coreConfig: { ...coreConfig, staffRoomType: 'king' } })} className="w-2.5 h-2.5 accent-blue-500" />
                          <span className="text-[10px]">大床</span>
                        </label>
                        <div className="flex items-center gap-0.5">
                          <NumberInput className={numInputMid} value={coreConfig.staffRoomPrice || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffRoomPrice: v } })} />
                          <span className="text-gray-400">元/间</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <NumberInput className={numInput} value={coreConfig.staffAccommodationNights || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, staffAccommodationNights: v } })} />
                          <span className="text-gray-400">晚</span>
                        </div>
                        <span className="text-gray-400 text-[10px]">({Math.ceil(totalStaff / 2)}间)</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-12">用餐:</span>
                <span className="text-gray-400">餐标</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInputMid} value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} />
                  <span className="text-gray-400 w-4">元/人</span>
                </div>
              </div>
              <Separator className="my-1" />

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-12">交通:</span>
                <span className="text-gray-400">大巴费</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInputMid} value={coreConfig.busFee} onChange={(v) => updateData({ coreConfig: { ...coreConfig, busFee: v } })} />
                  <span className="text-gray-400 w-6">元</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 每日费用 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">{projectData.project.type === 'half-day' ? '费用明细' : '每日费用'}</CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              {coreConfig.tripDays === 0 && projectData.project.type === 'multi-day' ? (
                <div className="text-center text-gray-400 text-xs py-4">请先设置行程天数</div>
              ) : (
                dailyExpenses.slice(0, Math.max(1, coreConfig.tripDays)).map((day, dayIdx) => {
                  // 计算住宿费用：双床房 + 大床房
                  const calculatedAccommodation = (projectData.project.type === 'multi-day' && dayIdx < coreConfig.accommodationDays)
                    ? (coreConfig.twinRoom?.price || 0) * ((coreConfig.twinRoom?.countClient || 0) + (coreConfig.twinRoom?.countStaff || 0)) +
                      (coreConfig.kingRoom?.price || 0) * ((coreConfig.kingRoom?.countClient || 0) + (coreConfig.kingRoom?.countStaff || 0))
                    : 0;
                  
                  // 计算单餐费用
                  const calculateMealAmount = (mealConfig: typeof day.lunch) => {
                    // 客户餐费
                    const clientMealType = mealConfig.clientMealType || 'individual';
                    const clientAmount = clientMealType === 'table'
                      ? (coreConfig.mealStandardClient || 0) * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
                      : (coreConfig.mealStandardClient || 0) * totalClients;
                    
                    // 工作人员餐费
                    const staffAmount = mealConfig.staffMealType === 'independent'
                      ? (coreConfig.mealStandardStaff || 0) * totalStaff
                      : 0;
                    
                    return clientAmount + staffAmount;
                  };
                  
                  // 确保lunch和dinner存在
                  const lunch = day.lunch || { ...DEFAULT_MEAL_CONFIG };
                  const dinner = day.dinner || { ...DEFAULT_MEAL_CONFIG };
                  
                  const lunchAmount = lunch.amount || calculateMealAmount(lunch);
                  const dinnerAmount = dinner.amount || calculateMealAmount(dinner);
                  
                  // 使用实际值或计算值
                  const accommodationValue = day.accommodation || calculatedAccommodation;
                  
                  // 计算每日总计
                  const dayTotal = accommodationValue + lunchAmount + dinnerAmount + 
                    (day.staffFees.guide * coreConfig.staffCounts.guide + day.staffFees.photographer * coreConfig.staffCounts.photographer + day.staffFees.videographer * coreConfig.staffCounts.videographer) +
                    day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0);
                  
                  // 更新餐食配置的辅助函数
                  const updateMeal = (mealType: 'lunch' | 'dinner', updates: Partial<typeof day.lunch>) => {
                    const newDays = [...dailyExpenses];
                    newDays[dayIdx] = {
                      ...day,
                      [mealType]: { ...day[mealType], ...updates }
                    };
                    updateData({ dailyExpenses: newDays });
                  };
                  
                  return (
                    <div key={day.day} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className="text-xs h-5 px-2 bg-blue-50 text-blue-700 border-blue-200">{projectData.project.type === 'half-day' ? '费用明细' : `第${day.day}天`}</Badge>
                        <span className="font-bold text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded">¥{dayTotal.toFixed(0)}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {projectData.project.type === 'multi-day' && (
                          <div className="flex items-center gap-0.5 bg-slate-50 rounded px-1.5 py-0.5">
                            <span className="text-gray-500">住宿</span>
                            <NumberInput 
                              className="h-6 w-16 text-xs px-1 border-0 bg-transparent" 
                              value={accommodationValue} 
                              onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, accommodation: v }; updateData({ dailyExpenses: newDays }); }} 
                            />
                            <span className="text-gray-400">元</span>
                          </div>
                        )}
                        {coreConfig.staffCounts.guide > 0 && (
                          <div className="flex items-center gap-0.5 bg-emerald-50 rounded px-1.5 py-0.5">
                            <span className="text-emerald-600">导游薪</span>
                            <NumberInput className="h-6 w-14 text-xs px-1 border-0 bg-transparent" value={day.staffFees.guide} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, guide: v } }; updateData({ dailyExpenses: newDays }); }} />
                            <span className="text-gray-400">元</span>
                          </div>
                        )}
                        {coreConfig.staffCounts.photographer > 0 && (
                          <div className="flex items-center gap-0.5 bg-purple-50 rounded px-1.5 py-0.5">
                            <span className="text-purple-600">摄影薪</span>
                            <NumberInput className="h-6 w-14 text-xs px-1 border-0 bg-transparent" value={day.staffFees.photographer} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, photographer: v } }; updateData({ dailyExpenses: newDays }); }} />
                            <span className="text-gray-400">元</span>
                          </div>
                        )}
                        {coreConfig.staffCounts.videographer > 0 && (
                          <div className="flex items-center gap-0.5 bg-rose-50 rounded px-1.5 py-0.5">
                            <span className="text-rose-600">摄像薪</span>
                            <NumberInput className="h-6 w-14 text-xs px-1 border-0 bg-transparent" value={day.staffFees.videographer} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, videographer: v } }; updateData({ dailyExpenses: newDays }); }} />
                            <span className="text-gray-400">元</span>
                          </div>
                        )}
                      </div>

                      {/* 中餐 */}
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-md p-2 space-y-1.5 border border-orange-100">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                          <span className="text-orange-600 font-semibold w-8 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                            中餐
                          </span>
                          <span className="text-gray-500 text-[10px]">客户</span>
                          <div className="flex gap-1 bg-white rounded px-1 py-0.5">
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-orange-600 transition-colors">
                              <input type="radio" name={`lunch-client-${day.day}`} checked={lunch.clientMealType === 'individual'} onChange={() => updateMeal('lunch', { clientMealType: 'individual', tableCount: 0 })} className="w-2.5 h-2.5 accent-orange-500" />
                              <span className="text-[10px]">例餐</span>
                            </label>
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-orange-600 transition-colors">
                              <input type="radio" name={`lunch-client-${day.day}`} checked={(lunch.clientMealType || 'table') === 'table'} onChange={() => updateMeal('lunch', { clientMealType: 'table', tableCount: lunch.tableCount || Math.ceil(totalClients / 10) })} className="w-2.5 h-2.5 accent-orange-500" />
                              <span className="text-[10px]">桌餐</span>
                            </label>
                          </div>
                          {(lunch.clientMealType || 'table') === 'table' && (
                            <div className="flex items-center gap-0.5 bg-white rounded px-1">
                              <NumberInput className="h-5 w-10 text-[10px] px-1 border-0 bg-transparent" value={lunch.tableCount || Math.ceil(totalClients / 10)} onChange={(v) => updateMeal('lunch', { tableCount: v })} />
                              <span className="text-gray-400 text-[10px]">桌</span>
                            </div>
                          )}
                          <span className="text-gray-500 text-[10px]">工作人员</span>
                          <div className="flex gap-1 bg-white rounded px-1 py-0.5">
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-orange-600 transition-colors">
                              <input type="radio" name={`lunch-staff-${day.day}`} checked={(lunch.staffMealType || 'with-group') === 'with-group'} onChange={() => updateMeal('lunch', { staffMealType: 'with-group' })} className="w-2.5 h-2.5 accent-orange-500" />
                              <span className="text-[10px]">随团</span>
                            </label>
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-orange-600 transition-colors">
                              <input type="radio" name={`lunch-staff-${day.day}`} checked={lunch.staffMealType === 'independent'} onChange={() => updateMeal('lunch', { staffMealType: 'independent' })} className="w-2.5 h-2.5 accent-orange-500" />
                              <span className="text-[10px]">独立</span>
                            </label>
                          </div>
                          {lunch.staffMealType === 'independent' && (
                            <div className="flex items-center gap-0.5 bg-white rounded px-1">
                              <NumberInput className="h-5 w-12 text-[10px] px-1 border-0 bg-transparent" value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} />
                              <span className="text-gray-400 text-[10px]">元/人</span>
                            </div>
                          )}
                          <div className="flex items-center gap-0.5 ml-auto bg-white rounded px-1.5 py-0.5 shadow-sm">
                            <span className="text-orange-500 text-[10px]">¥</span>
                            <NumberInput className="h-5 w-16 text-xs px-0 border-0 bg-transparent text-right font-medium" value={lunchAmount} onChange={(v) => updateMeal('lunch', { amount: v })} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-400 text-[10px] w-8">餐厅</span>
                          <Input 
                            placeholder="输入餐厅名称（可选）" 
                            className="h-5 flex-1 text-[10px] px-1.5 bg-white border-orange-100 focus:border-orange-300" 
                            value={lunch.restaurantName || ''} 
                            onChange={(e) => updateMeal('lunch', { restaurantName: e.target.value })} 
                          />
                        </div>
                      </div>

                      {/* 晚餐 */}
                      {/* 晚餐 */}
                      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-md p-2 space-y-1.5 border border-indigo-100">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                          <span className="text-indigo-600 font-semibold w-8 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                            晚餐
                          </span>
                          <span className="text-gray-500 text-[10px]">客户</span>
                          <div className="flex gap-1 bg-white rounded px-1 py-0.5">
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-indigo-600 transition-colors">
                              <input type="radio" name={`dinner-client-${day.day}`} checked={dinner.clientMealType === 'individual'} onChange={() => updateMeal('dinner', { clientMealType: 'individual', tableCount: 0 })} className="w-2.5 h-2.5 accent-indigo-500" />
                              <span className="text-[10px]">例餐</span>
                            </label>
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-indigo-600 transition-colors">
                              <input type="radio" name={`dinner-client-${day.day}`} checked={(dinner.clientMealType || 'table') === 'table'} onChange={() => updateMeal('dinner', { clientMealType: 'table', tableCount: dinner.tableCount || Math.ceil(totalClients / 10) })} className="w-2.5 h-2.5 accent-indigo-500" />
                              <span className="text-[10px]">桌餐</span>
                            </label>
                          </div>
                          {(dinner.clientMealType || 'table') === 'table' && (
                            <div className="flex items-center gap-0.5 bg-white rounded px-1">
                              <NumberInput className="h-5 w-10 text-[10px] px-1 border-0 bg-transparent" value={dinner.tableCount || Math.ceil(totalClients / 10)} onChange={(v) => updateMeal('dinner', { tableCount: v })} />
                              <span className="text-gray-400 text-[10px]">桌</span>
                            </div>
                          )}
                          <span className="text-gray-500 text-[10px]">工作人员</span>
                          <div className="flex gap-1 bg-white rounded px-1 py-0.5">
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-indigo-600 transition-colors">
                              <input type="radio" name={`dinner-staff-${day.day}`} checked={(dinner.staffMealType || 'with-group') === 'with-group'} onChange={() => updateMeal('dinner', { staffMealType: 'with-group' })} className="w-2.5 h-2.5 accent-indigo-500" />
                              <span className="text-[10px]">随团</span>
                            </label>
                            <label className="flex items-center gap-0.5 cursor-pointer hover:text-indigo-600 transition-colors">
                              <input type="radio" name={`dinner-staff-${day.day}`} checked={dinner.staffMealType === 'independent'} onChange={() => updateMeal('dinner', { staffMealType: 'independent' })} className="w-2.5 h-2.5 accent-indigo-500" />
                              <span className="text-[10px]">独立</span>
                            </label>
                          </div>
                          {dinner.staffMealType === 'independent' && (
                            <div className="flex items-center gap-0.5 bg-white rounded px-1">
                              <NumberInput className="h-5 w-12 text-[10px] px-1 border-0 bg-transparent" value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} />
                              <span className="text-gray-400 text-[10px]">元/人</span>
                            </div>
                          )}
                          <div className="flex items-center gap-0.5 ml-auto bg-white rounded px-1.5 py-0.5 shadow-sm">
                            <span className="text-indigo-500 text-[10px]">¥</span>
                            <NumberInput className="h-5 w-16 text-xs px-0 border-0 bg-transparent text-right font-medium" value={dinnerAmount} onChange={(v) => updateMeal('dinner', { amount: v })} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-400 text-[10px] w-8">餐厅</span>
                          <Input 
                            placeholder="输入餐厅名称（可选）" 
                            className="h-5 flex-1 text-[10px] px-1.5 bg-white border-indigo-100 focus:border-indigo-300" 
                            value={dinner.restaurantName || ''} 
                            onChange={(e) => updateMeal('dinner', { restaurantName: e.target.value })} 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">单项费用</span>
                          <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: [...day.singleItems, { id: Date.now().toString(), name: '', remark: '', startTime: '', endTime: '', price: 0, count: totalClients, totalPrice: 0 }] }; updateData({ dailyExpenses: newDays }); }}><Plus className="w-3 h-3" /></Button>
                        </div>
                        {day.singleItems.map((item, itemIdx) => (
                          <div key={item.id} className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-md p-1.5 space-y-1.5 border border-slate-100">
                            <div className="flex gap-1 items-center text-xs">
                              <div className="flex items-center gap-0.5">
                                <input 
                                  type="time" 
                                  className="h-6 w-[72px] text-[10px] px-1 border rounded bg-white cursor-pointer focus:ring-1 focus:ring-blue-400 focus:border-blue-400" 
                                  value={item.startTime || ''} 
                                  onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], startTime: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} 
                                />
                                <span className="text-gray-300">-</span>
                                <input 
                                  type="time" 
                                  className="h-6 w-[72px] text-[10px] px-1 border rounded bg-white cursor-pointer focus:ring-1 focus:ring-blue-400 focus:border-blue-400" 
                                  value={item.endTime || ''} 
                                  onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], endTime: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} 
                                />
                              </div>
                              <Input placeholder="项目名称" className="h-6 flex-1 text-xs px-1.5" value={item.name} onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], name: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: day.singleItems.filter((_, i) => i !== itemIdx) }; updateData({ dailyExpenses: newDays }); }}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                            <div className="flex gap-1 items-center text-xs">
                              <Input placeholder="备注" className="h-6 flex-1 text-xs px-1.5" value={item.remark || ''} onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], remark: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <div className="flex items-center gap-0.5">
                                <span className="text-gray-400 text-[10px]">¥</span>
                                <NumberInput className="h-6 w-16 text-xs px-1" value={item.price} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], price: v, totalPrice: v * items[itemIdx].count }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-400 text-[10px]">x</span>
                                <NumberInput className="h-6 w-10 text-xs px-1" value={item.count} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], count: v || totalClients, totalPrice: items[itemIdx].price * (v || totalClients) }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                                <span className="text-gray-400 text-[10px]">=</span>
                                <span className="w-16 text-right font-semibold text-green-600">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* 其他费用 */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-2 px-3 bg-gradient-to-r from-slate-50 to-gray-50"><CardTitle className="text-sm font-medium text-slate-700">其他费用</CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {[{ key: 'insurance', label: '保险', bg: 'bg-blue-50', text: 'text-blue-600' }, { key: 'serviceFee', label: '服务费', bg: 'bg-purple-50', text: 'text-purple-600' }, { key: 'reserveFund', label: '备用金', bg: 'bg-amber-50', text: 'text-amber-600' }, { key: 'materialFee', label: '物料', bg: 'bg-pink-50', text: 'text-pink-600' }, { key: 'giftFee', label: '礼品', bg: 'bg-rose-50', text: 'text-rose-600' }, { key: 'other', label: '其他', bg: 'bg-gray-50', text: 'text-gray-600' }].map(({ key, label, bg, text }) => (
                  <div key={key} className={`flex items-center gap-1 ${bg} rounded px-1.5 py-1`}>
                    <span className={`${text} text-[10px]`}>{label}</span>
                    <NumberInput className="h-6 flex-1 text-xs px-1 border-0 bg-transparent" value={otherExpenses[key as keyof typeof otherExpenses]} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, [key]: v } })} />
                    <span className="text-gray-400 text-[10px]">元</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧面板 */}
        <div className="w-80 flex-shrink-0 space-y-3 sticky top-14 self-start">
          {/* 成本表 */}
          <Card className="shadow-md border-slate-200 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
            <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-slate-600 to-slate-700">
              <CardTitle className="text-sm font-semibold text-white">成本核算表</CardTitle>
              <p className="text-xs text-slate-300">内部参考</p>
            </CardHeader>
            <CardContent className="pt-3 pb-3 px-3">
              <div className="space-y-0.5 text-xs">
                {projectData.project.type === 'multi-day' && <div className="flex justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 rounded px-1 transition-colors"><span className="text-gray-600">住宿费</span><span className="font-medium text-slate-700">{formatMoney(summary.totalAccommodation)}</span></div>}
                <div className="flex justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 rounded px-1 transition-colors"><span className="text-gray-600">用餐费</span><span className="font-medium text-slate-700">{formatMoney(summary.totalMeal)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 rounded px-1 transition-colors"><span className="text-gray-600">交通费</span><span className="font-medium text-slate-700">{formatMoney(summary.totalBus)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 rounded px-1 transition-colors"><span className="text-gray-600">工作人员</span><span className="font-medium text-slate-700">{formatMoney(summary.totalStaffFee)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 rounded px-1 transition-colors"><span className="text-gray-600">单项费用</span><span className="font-medium text-slate-700">{formatMoney(summary.totalSingleItems)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 hover:bg-slate-50 rounded px-1 transition-colors"><span className="text-gray-600">其他费用</span><span className="font-medium text-slate-700">{formatMoney(summary.totalOtherExpenses)}</span></div>
                <div className="flex justify-between py-2 bg-gradient-to-r from-slate-100 to-slate-50 rounded mt-2 px-2 shadow-sm"><span className="font-semibold text-slate-800">总成本</span><span className="font-bold text-slate-800 text-lg">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between py-1.5 text-gray-500 mt-1"><span>人均成本</span><span className="font-medium text-slate-600">{formatMoney(summary.avgCostPerClient)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 报价单 */}
          <Card className="shadow-md border-emerald-200 bg-gradient-to-b from-emerald-50 to-white overflow-hidden">
            <CardHeader className="py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500">
              <CardTitle className="text-sm font-semibold text-white">报价单</CardTitle>
              <p className="text-xs text-emerald-100">给客户展示</p>
            </CardHeader>
            <CardContent className="pt-3 pb-3 px-3">
              <div className="space-y-0.5 text-xs">
                {projectData.project.type === 'multi-day' && summary.totalAccommodation > 0 && <div className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">住宿费</span><span className="font-medium text-emerald-700">{formatMoney(summary.totalAccommodation)}</span></div>}
                {summary.totalMeal > 0 && <div className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">用餐费</span><span className="font-medium text-emerald-700">{formatMoney(summary.totalMeal)}</span></div>}
                {summary.totalBus > 0 && <div className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">交通费</span><span className="font-medium text-emerald-700">{formatMoney(summary.totalBus)}</span></div>}
                {allSingleItems.map((item, idx) => <div key={idx} className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">{item.name || `项目${idx + 1}`}</span><span className="font-medium text-emerald-700">{formatMoney(item.totalPrice)}</span></div>)}
                {otherExpenses.insurance > 0 && <div className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">保险费</span><span className="font-medium text-emerald-700">{formatMoney(otherExpenses.insurance)}</span></div>}
                {otherExpenses.materialFee > 0 && <div className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">物料费</span><span className="font-medium text-emerald-700">{formatMoney(otherExpenses.materialFee)}</span></div>}
                {otherExpenses.giftFee > 0 && <div className="flex justify-between py-1.5 border-b border-emerald-100 hover:bg-emerald-50 rounded px-1 transition-colors"><span className="text-gray-600">礼品费</span><span className="font-medium text-emerald-700">{formatMoney(otherExpenses.giftFee)}</span></div>}
                <div className="flex justify-between py-1.5 bg-emerald-100/50 rounded px-1 mt-1"><span className="text-gray-600">小计</span><span className="font-medium">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-emerald-100"><span className="text-gray-600">服务费 (10%)</span><span className="font-medium">{formatMoney(serviceFee)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-emerald-100"><span className="text-gray-600">税费 (6%)</span><span className="font-medium">{formatMoney(tax)}</span></div>
                <div className="flex justify-between py-2 bg-gradient-to-r from-emerald-100 to-teal-50 rounded mt-1 px-2 shadow-sm"><span className="font-semibold text-emerald-800">报价合计</span><span className="font-bold text-emerald-700 text-lg">{formatMoney(totalPrice)}</span></div>
                <div className="flex justify-between items-center py-1.5 border-b border-emerald-100">
                  <span className="text-gray-600">优惠</span>
                  <div className="flex items-center gap-0.5"><span className="text-gray-400">-</span><NumberInput className="h-6 w-16 text-xs px-1 text-right border-emerald-200" value={discount} onChange={(v) => setDiscount(v)} /></div>
                </div>
                <div className="flex justify-between py-2 bg-gradient-to-r from-emerald-200 to-teal-100 rounded mt-1 px-2 shadow-sm"><span className="font-bold text-emerald-800">应付金额</span><span className="font-bold text-emerald-700 text-xl">{formatMoney(finalPrice)}</span></div>
                <div className="flex justify-between py-1.5 text-gray-500 mt-1"><span>人均费用</span><span className="font-medium text-emerald-600">{formatMoney(pricePerClient)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 人员统计 */}
          <Card className="shadow-md border-slate-200 overflow-hidden">
            <CardHeader className="py-2 px-3 bg-gradient-to-r from-blue-500 to-indigo-500"><CardTitle className="text-sm font-semibold text-white">人员统计</CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-50 rounded p-2 text-center"><div className="text-lg font-bold text-blue-600">{totalClients}</div><div className="text-gray-500">客户人数</div></div>
                <div className="bg-green-50 rounded p-2 text-center"><div className="text-lg font-bold text-green-600">{totalStaff}</div><div className="text-gray-500">工作人员</div></div>
                <div className="bg-purple-50 rounded p-2 text-center"><div className="text-lg font-bold text-purple-600">{totalPeople}</div><div className="text-gray-500">总人数</div></div>
                <div className="bg-orange-50 rounded p-2 text-center"><div className="text-lg font-bold text-orange-600">{projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : `${coreConfig.tripDays}天`}</div><div className="text-gray-500">行程类型</div></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
