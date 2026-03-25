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
import { ProjectData, ProjectType, AccommodationType, DEFAULT_STAFF_FEES, ACCOMMODATION_TYPE_LABELS } from '@/types';
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
    if (summary.totalSingleItems + summary.totalTeamExpenses > 0) lines.push(`活动费用：${formatMoney(summary.totalSingleItems + summary.totalTeamExpenses)}`);
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
          {/* 基础信息 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">基础信息</CardTitle></CardHeader>
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
              <Separator className="my-1" />

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">客户:</span>
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
                <span className="text-blue-600 font-medium">共{totalClients}人</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">工作人员:</span>
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
                <span className="text-green-600 font-medium">共{totalStaff}人</span>
              </div>
              
              {/* 工作人员日薪资参考 - 不包含司机 */}
              {(coreConfig.staffCounts.guide > 0 || coreConfig.staffCounts.photographer > 0 || coreConfig.staffCounts.videographer > 0) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="text-gray-500 w-16">日薪资:</span>
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
                <>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="text-gray-500 w-16">住宿:</span>
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
                    <span className="text-gray-400 ml-1">房单价</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInputMid} value={coreConfig.roomPrice} onChange={(v) => updateData({ coreConfig: { ...coreConfig, roomPrice: v } })} />
                      <span className="text-gray-400 w-6">元</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs pl-[4.5rem]">
                    <span className="text-gray-400">客户</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInput} value={coreConfig.roomCountClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, roomCountClient: v } })} />
                      <span className="text-gray-400 w-4">间</span>
                    </div>
                    <span className="text-gray-400 text-xs">工作人员</span>
                    <div className="flex items-center gap-0.5">
                      <NumberInput className={numInput} value={coreConfig.roomCountStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, roomCountStaff: v } })} />
                      <span className="text-gray-400 w-4">间</span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">用餐:</span>
                <span className="text-gray-400">日餐数</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInput} value={coreConfig.mealCountPerDay} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealCountPerDay: v } })} />
                  <span className="text-gray-400 w-6">餐</span>
                </div>
                <span className="text-gray-400 text-xs">客户餐标</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInputMid} value={coreConfig.mealStandardClient || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardClient: v } })} />
                  <span className="text-gray-400 w-4">元</span>
                </div>
                <span className="text-gray-400 text-xs">工作人员餐标</span>
                <div className="flex items-center gap-0.5">
                  <NumberInput className={numInputMid} value={coreConfig.mealStandardStaff || 0} onChange={(v) => updateData({ coreConfig: { ...coreConfig, mealStandardStaff: v } })} />
                  <span className="text-gray-400 w-4">元</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">交通:</span>
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
            <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{projectData.project.type === 'half-day' ? '费用明细' : '每日费用'}</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600" onClick={() => {
                // 自动填充所有每日费用
                const newDays = dailyExpenses.slice(0, Math.max(1, coreConfig.tripDays)).map((day, idx) => {
                  // 计算住宿建议值：房单价 * (客户房间数 + 工作人员房间数)，仅在有住宿天数时计算
                  const suggestedAccommodation = (projectData.project.type === 'multi-day' && idx < coreConfig.accommodationDays) 
                    ? coreConfig.roomPrice * ((coreConfig.roomCountClient || 0) + (coreConfig.roomCountStaff || 0))
                    : 0;
                  
                  // 计算餐费建议值：(客户餐标 * 客户人数 + 工作人员餐标 * 工作人员人数) * 日餐数
                  const suggestedMeal = ((coreConfig.mealStandardClient || 0) * totalClients + (coreConfig.mealStandardStaff || 0) * totalStaff) * coreConfig.mealCountPerDay;
                  
                  return {
                    ...day,
                    accommodation: suggestedAccommodation,
                    meal: suggestedMeal,
                  };
                });
                updateData({ dailyExpenses: newDays });
              }}>自动填充</Button>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              {coreConfig.tripDays === 0 && projectData.project.type === 'multi-day' ? (
                <div className="text-center text-gray-400 text-xs py-4">请先设置行程天数</div>
              ) : (
                dailyExpenses.slice(0, Math.max(1, coreConfig.tripDays)).map((day, dayIdx) => {
                  // 计算每日总计（不含司机薪资，司机薪资已包含在大巴费中）
                  const dayTotal = day.accommodation + day.meal + 
                    (day.staffFees.guide * coreConfig.staffCounts.guide + day.staffFees.photographer * coreConfig.staffCounts.photographer + day.staffFees.videographer * coreConfig.staffCounts.videographer) +
                    day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0) + day.teamExpenses;
                  
                  // 计算建议值
                  const suggestedAccommodation = (projectData.project.type === 'multi-day' && dayIdx < coreConfig.accommodationDays) 
                    ? coreConfig.roomPrice * ((coreConfig.roomCountClient || 0) + (coreConfig.roomCountStaff || 0))
                    : 0;
                  const suggestedMeal = ((coreConfig.mealStandardClient || 0) * totalClients + (coreConfig.mealStandardStaff || 0) * totalStaff) * coreConfig.mealCountPerDay;
                  
                  return (
                    <div key={day.day} className="border rounded p-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className="text-xs h-5">{projectData.project.type === 'half-day' ? '费用' : `第${day.day}天`}</Badge>
                        <span className="font-semibold text-blue-600">¥{dayTotal.toFixed(0)}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                        {projectData.project.type === 'multi-day' && (
                          <>
                            <span className="text-gray-400">住宿</span>
                            <div className="flex items-center gap-0.5">
                              <NumberInput className={numInput} value={day.accommodation} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, accommodation: v }; updateData({ dailyExpenses: newDays }); }} />
                              <span className="text-gray-400">元</span>
                              {suggestedAccommodation > 0 && day.accommodation !== suggestedAccommodation && (
                                <button onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, accommodation: suggestedAccommodation }; updateData({ dailyExpenses: newDays }); }} className="text-blue-400 hover:text-blue-600 text-[10px]">({suggestedAccommodation})</button>
                              )}
                            </div>
                          </>
                        )}
                        <span className="text-gray-400">用餐</span>
                        <div className="flex items-center gap-0.5">
                          <NumberInput className={numInput} value={day.meal} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, meal: v }; updateData({ dailyExpenses: newDays }); }} />
                          <span className="text-gray-400">元</span>
                          {suggestedMeal > 0 && day.meal !== suggestedMeal && (
                            <button onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, meal: suggestedMeal }; updateData({ dailyExpenses: newDays }); }} className="text-blue-400 hover:text-blue-600 text-[10px]">({suggestedMeal})</button>
                          )}
                        </div>
                        <span className="text-gray-400">团队</span>
                        <div className="flex items-center gap-0.5">
                          <NumberInput className={numInput} value={day.teamExpenses} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, teamExpenses: v }; updateData({ dailyExpenses: newDays }); }} />
                          <span className="text-gray-400">元</span>
                        </div>
                        {coreConfig.staffCounts.guide > 0 && <><span className="text-gray-400">导游薪</span><div className="flex items-center gap-0.5"><NumberInput className={numInput} value={day.staffFees.guide} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, guide: v } }; updateData({ dailyExpenses: newDays }); }} /><span className="text-gray-400">元</span></div></>}
                        {coreConfig.staffCounts.photographer > 0 && <><span className="text-gray-400">摄影薪</span><div className="flex items-center gap-0.5"><NumberInput className={numInput} value={day.staffFees.photographer} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, photographer: v } }; updateData({ dailyExpenses: newDays }); }} /><span className="text-gray-400">元</span></div></>}
                        {coreConfig.staffCounts.videographer > 0 && <><span className="text-gray-400">摄像薪</span><div className="flex items-center gap-0.5"><NumberInput className={numInput} value={day.staffFees.videographer} onChange={(v) => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, videographer: v } }; updateData({ dailyExpenses: newDays }); }} /><span className="text-gray-400">元</span></div></>}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">单项费用</span>
                          <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: [...day.singleItems, { id: Date.now().toString(), name: '', price: 0, count: 1, totalPrice: 0 }] }; updateData({ dailyExpenses: newDays }); }}><Plus className="w-3 h-3" /></Button>
                        </div>
                        {day.singleItems.map((item, itemIdx) => (
                          <div key={item.id} className="flex gap-1 items-center text-xs">
                            <Input placeholder="名称" className="h-6 flex-1 text-xs px-1.5" value={item.name} onChange={(e) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], name: e.target.value }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                            <div className="flex items-center gap-0.5">
                              <NumberInput placeholder="单价" className="h-6 w-14 text-xs px-1" value={item.price} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], price: v, totalPrice: v * items[itemIdx].count }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <span className="text-gray-400 w-4">元</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <NumberInput placeholder="数" className="h-6 w-10 text-xs px-1" value={item.count} onChange={(v) => { const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], count: v || 1, totalPrice: items[itemIdx].price * (v || 1) }; newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays }); }} />
                              <span className="text-gray-400 w-4">个</span>
                            </div>
                            <span className="w-12 text-right font-medium">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600" onClick={() => { const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: day.singleItems.filter((_, i) => i !== itemIdx) }; updateData({ dailyExpenses: newDays }); }}><Trash2 className="w-3 h-3" /></Button>
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
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">其他费用</CardTitle></CardHeader>
            <CardContent className="pt-0 pb-3 px-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {[{ key: 'insurance', label: '保险' }, { key: 'serviceFee', label: '服务费' }, { key: 'reserveFund', label: '备用金' }, { key: 'materialFee', label: '物料' }, { key: 'giftFee', label: '礼品' }, { key: 'other', label: '其他' }].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-0.5">
                    <span className="text-gray-400">{label}</span>
                    <NumberInput className={numInputMid} value={otherExpenses[key as keyof typeof otherExpenses]} onChange={(v) => updateData({ otherExpenses: { ...otherExpenses, [key]: v } })} />
                    <span className="text-gray-400 w-6">元</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧面板 */}
        <div className="w-80 flex-shrink-0 space-y-3 sticky top-14 self-start">
          {/* 成本表 */}
          <Card className="shadow-sm border-slate-200 bg-slate-50/50">
            <CardHeader className="py-2 px-3 bg-slate-100/50">
              <CardTitle className="text-sm font-medium text-slate-700">成本核算表</CardTitle>
              <p className="text-xs text-slate-500">内部参考</p>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-3">
              <div className="space-y-1 text-xs">
                {projectData.project.type === 'multi-day' && <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">住宿费</span><span className="font-medium">{formatMoney(summary.totalAccommodation)}</span></div>}
                <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">用餐费</span><span className="font-medium">{formatMoney(summary.totalMeal)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">交通费</span><span className="font-medium">{formatMoney(summary.totalBus)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">工作人员</span><span className="font-medium">{formatMoney(summary.totalStaffFee)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">单项费用</span><span className="font-medium">{formatMoney(summary.totalSingleItems)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">团队费用</span><span className="font-medium">{formatMoney(summary.totalTeamExpenses)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-gray-600">其他费用</span><span className="font-medium">{formatMoney(summary.totalOtherExpenses)}</span></div>
                <div className="flex justify-between py-1.5 bg-slate-100/50 rounded mt-1 px-1"><span className="font-semibold text-slate-700">总成本</span><span className="font-bold text-slate-700 text-base">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between py-1 text-gray-500"><span>人均成本</span><span className="font-medium">{formatMoney(summary.avgCostPerClient)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 报价单 */}
          <Card className="shadow-sm border-green-200 bg-green-50/50">
            <CardHeader className="py-2 px-3 bg-green-100/50">
              <CardTitle className="text-sm font-medium text-green-700">报价单</CardTitle>
              <p className="text-xs text-green-600">给客户展示</p>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-3">
              <div className="space-y-1 text-xs">
                {projectData.project.type === 'multi-day' && summary.totalAccommodation > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">住宿费</span><span className="font-medium">{formatMoney(summary.totalAccommodation)}</span></div>}
                {summary.totalMeal > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">用餐费</span><span className="font-medium">{formatMoney(summary.totalMeal)}</span></div>}
                {summary.totalBus > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">交通费</span><span className="font-medium">{formatMoney(summary.totalBus)}</span></div>}
                {allSingleItems.map((item, idx) => <div key={idx} className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">{item.name || `项目${idx + 1}`}</span><span className="font-medium">{formatMoney(item.totalPrice)}</span></div>)}
                {summary.totalTeamExpenses > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">活动费用</span><span className="font-medium">{formatMoney(summary.totalTeamExpenses)}</span></div>}
                {otherExpenses.insurance > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">保险费</span><span className="font-medium">{formatMoney(otherExpenses.insurance)}</span></div>}
                {otherExpenses.materialFee > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">物料费</span><span className="font-medium">{formatMoney(otherExpenses.materialFee)}</span></div>}
                {otherExpenses.giftFee > 0 && <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">礼品费</span><span className="font-medium">{formatMoney(otherExpenses.giftFee)}</span></div>}
                <div className="flex justify-between py-0.5 bg-green-100/30 rounded px-1 mt-1"><span className="text-gray-600">小计</span><span className="font-medium">{formatMoney(summary.totalCost)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">服务费 (10%)</span><span className="font-medium">{formatMoney(serviceFee)}</span></div>
                <div className="flex justify-between py-0.5 border-b border-green-100"><span className="text-gray-600">税费 (6%)</span><span className="font-medium">{formatMoney(tax)}</span></div>
                <div className="flex justify-between py-1 bg-green-100/50 rounded mt-1 px-1"><span className="font-semibold text-green-700">报价合计</span><span className="font-bold text-green-700 text-base">{formatMoney(totalPrice)}</span></div>
                <div className="flex justify-between items-center py-0.5 border-b border-green-100">
                  <span className="text-gray-600">优惠</span>
                  <div className="flex items-center gap-0.5"><span className="text-gray-400">-</span><NumberInput className="h-6 w-16 text-xs px-1 text-right" value={discount} onChange={(v) => setDiscount(v)} /></div>
                </div>
                <div className="flex justify-between py-1.5 bg-green-200/50 rounded mt-1 px-1"><span className="font-bold text-green-800">应付金额</span><span className="font-bold text-green-800 text-lg">{formatMoney(finalPrice)}</span></div>
                <div className="flex justify-between py-1 text-gray-500"><span>人均费用</span><span className="font-medium text-green-600">{formatMoney(pricePerClient)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* 人员统计 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3"><CardTitle className="text-sm font-medium">人员统计</CardTitle></CardHeader>
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
