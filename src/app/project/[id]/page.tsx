'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ProjectData, ProjectType, DEFAULT_STAFF_FEES } from '@/types';
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
  const [discount, setDiscount] = useState(0); // 优惠金额

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
    const taxRate = 0.06;
    const tax = summary.totalCost * taxRate;
    const totalPrice = summary.totalCost + serviceFee + tax;
    const finalPrice = totalPrice - discount;
    
    const lines = [
      '═'.repeat(50), '研学旅行报价单', '═'.repeat(50),
      `项目名称：${projectData.project.name}`,
      `行程天数：${coreConfig.tripDays}天`,
      `客户人数：${summary.totalClients}人`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '', '─'.repeat(50), '费用明细', '─'.repeat(50),
      `住宿费用：${formatMoney(summary.totalAccommodation)}`,
      `用餐费用：${formatMoney(summary.totalMeal)}`,
      `交通费用：${formatMoney(summary.totalBus)}`,
      `活动费用：${formatMoney(summary.totalSingleItems + summary.totalTeamExpenses)}`,
      `保险费用：${formatMoney(projectData.otherExpenses.insurance)}`,
      `物料费用：${formatMoney(projectData.otherExpenses.materialFee)}`,
      `礼品费用：${formatMoney(projectData.otherExpenses.giftFee)}`,
      '', '─'.repeat(50),
      `小计：${formatMoney(summary.totalCost)}`,
      `服务费(10%)：${formatMoney(serviceFee)}`,
      `税费(6%)：${formatMoney(tax)}`,
      `报价合计：${formatMoney(totalPrice)}`,
      `优惠：-${formatMoney(discount)}`,
      '', '═'.repeat(50),
      `应付金额：${formatMoney(finalPrice)}`,
      `人均费用：${formatMoney(finalPrice / (summary.totalClients || 1))}`,
    ];
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

  // 确保每日数据长度正确
  if (dailyExpenses.length !== coreConfig.tripDays) {
    const newData = Array.from({ length: coreConfig.tripDays }, (_, i) => 
      dailyExpenses[i] || { day: i + 1, accommodation: 0, meal: 0, staffFees: { ...DEFAULT_STAFF_FEES }, singleItems: [], teamExpenses: 0 }
    );
    updateData({ dailyExpenses: newData });
  }

  // 小数字输入框样式
  const numInput = "h-7 w-14 text-xs px-1.5";
  const numInputMid = "h-7 w-20 text-xs px-1.5";

  // 报价计算
  const serviceFeeRate = 0.1; // 10%服务费
  const taxRate = 0.06; // 6%税费
  const serviceFee = summary.totalCost * serviceFeeRate;
  const tax = summary.totalCost * taxRate;
  const totalPrice = summary.totalCost + serviceFee + tax;
  const finalPrice = totalPrice - discount;
  const pricePerClient = totalClients > 0 ? finalPrice / totalClients : 0;

  // 收集所有单项费用（用于报价单展示）
  const allSingleItems: { name: string; price: number; count: number; totalPrice: number }[] = [];
  dailyExpenses.forEach(day => {
    day.singleItems.forEach(item => {
      if (item.name && (item.totalPrice || item.price * item.count) > 0) {
        allSingleItems.push({
          name: item.name,
          price: item.price,
          count: item.count,
          totalPrice: item.totalPrice || item.price * item.count
        });
      }
    });
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部固定栏 */}
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
        {/* 左侧：填写部分 */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* 基础信息 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-medium">基础信息</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              {/* 类型选择 - 点选按钮 */}
              <div className="flex items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-10">类型</span>
                <div className="flex gap-1">
                  {PROJECT_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => updateData({ project: { ...projectData.project, type: type.value } })}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        projectData.project.type === type.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                <span className="text-gray-500 w-10 ml-2">天数</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="1" className={numInput} value={coreConfig.tripDays} onChange={(e) => {
                    const days = parseInt(e.target.value) || 1;
                    updateData({ coreConfig: { ...coreConfig, tripDays: days, accommodationDays: days > 1 ? days - 1 : 0 } });
                  }} />
                  <span className="text-gray-400 w-4">天</span>
                </div>
                <span className="text-gray-500 w-10">住宿</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.accommodationDays} onChange={(e) => updateData({ coreConfig: { ...coreConfig, accommodationDays: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-4">晚</span>
                </div>
              </div>

              <Separator className="my-1" />

              {/* 人员 - 客户 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">客户:</span>
                <span className="text-gray-400">学生</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.studentCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, studentCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">家长</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.parentCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, parentCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">老师</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.teacherCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, teacherCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-blue-600 font-medium">共{totalClients}人</span>
              </div>

              {/* 人员 - 工作人员 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">工作人员:</span>
                <span className="text-gray-400">导游</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.guide} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, guide: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">摄影</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.photographer} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, photographer: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">摄像</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.videographer} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, videographer: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-gray-400">司机</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.driver} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, driver: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400 w-4">人</span>
                </div>
                <span className="text-green-600 font-medium">共{totalStaff}人</span>
              </div>

              <Separator className="my-1" />

              {/* 费用配置 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">住宿:</span>
                <span className="text-gray-400">房单价</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" step="0.01" className={numInputMid} value={coreConfig.roomPrice} onChange={(e) => updateData({ coreConfig: { ...coreConfig, roomPrice: parseFloat(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-6">元</span>
                </div>
                <span className="text-gray-400">房间数</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" className={numInput} value={coreConfig.roomCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, roomCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-6">间</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-gray-500 w-16">用餐:</span>
                <span className="text-gray-400">餐标</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" step="0.01" className={numInputMid} value={coreConfig.mealStandard} onChange={(e) => updateData({ coreConfig: { ...coreConfig, mealStandard: parseFloat(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-6">元</span>
                </div>
                <span className="text-gray-400">日餐数</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" max="5" className={numInput} value={coreConfig.mealCountPerDay} onChange={(e) => updateData({ coreConfig: { ...coreConfig, mealCountPerDay: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-6">餐</span>
                </div>
                <span className="text-gray-400">大巴</span>
                <div className="flex items-center gap-0.5">
                  <Input type="number" min="0" step="0.01" className={numInputMid} value={coreConfig.busFee} onChange={(e) => updateData({ coreConfig: { ...coreConfig, busFee: parseFloat(e.target.value) || 0 } })} />
                  <span className="text-gray-400 w-6">元</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 每日费用 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-medium">每日费用</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3 space-y-2">
              {dailyExpenses.slice(0, coreConfig.tripDays).map((day, dayIdx) => {
                const dayTotal = day.accommodation + day.meal + 
                  (day.staffFees.guide * coreConfig.staffCounts.guide + day.staffFees.photographer * coreConfig.staffCounts.photographer + day.staffFees.videographer * coreConfig.staffCounts.videographer + day.staffFees.driver * coreConfig.staffCounts.driver) +
                  day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0) + day.teamExpenses;
                
                return (
                  <div key={day.day} className="border rounded p-2 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="text-xs h-5">第{day.day}天</Badge>
                      <span className="font-semibold text-blue-600">¥{dayTotal.toFixed(0)}</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                      <span className="text-gray-400">住宿</span>
                      <div className="flex items-center gap-0.5">
                        <Input type="number" min="0" step="0.01" className={numInput} value={day.accommodation} onChange={(e) => {
                          const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, accommodation: parseFloat(e.target.value) || 0 }; updateData({ dailyExpenses: newDays });
                        }} />
                        <span className="text-gray-400">元</span>
                      </div>
                      <span className="text-gray-400">用餐</span>
                      <div className="flex items-center gap-0.5">
                        <Input type="number" min="0" step="0.01" className={numInput} value={day.meal} onChange={(e) => {
                          const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, meal: parseFloat(e.target.value) || 0 }; updateData({ dailyExpenses: newDays });
                        }} />
                        <span className="text-gray-400">元</span>
                      </div>
                      <span className="text-gray-400">团队</span>
                      <div className="flex items-center gap-0.5">
                        <Input type="number" min="0" step="0.01" className={numInput} value={day.teamExpenses} onChange={(e) => {
                          const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, teamExpenses: parseFloat(e.target.value) || 0 }; updateData({ dailyExpenses: newDays });
                        }} />
                        <span className="text-gray-400">元</span>
                      </div>
                      {coreConfig.staffCounts.guide > 0 && <>
                        <span className="text-gray-400">导游薪</span>
                        <div className="flex items-center gap-0.5">
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.guide} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, guide: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                          <span className="text-gray-400">元</span>
                        </div>
                      </>}
                      {coreConfig.staffCounts.photographer > 0 && <>
                        <span className="text-gray-400">摄影薪</span>
                        <div className="flex items-center gap-0.5">
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.photographer} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, photographer: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                          <span className="text-gray-400">元</span>
                        </div>
                      </>}
                      {coreConfig.staffCounts.videographer > 0 && <>
                        <span className="text-gray-400">摄像薪</span>
                        <div className="flex items-center gap-0.5">
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.videographer} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, videographer: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                          <span className="text-gray-400">元</span>
                        </div>
                      </>}
                      {coreConfig.staffCounts.driver > 0 && <>
                        <span className="text-gray-400">司机薪</span>
                        <div className="flex items-center gap-0.5">
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.driver} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, driver: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                          <span className="text-gray-400">元</span>
                        </div>
                      </>}
                    </div>

                    {/* 单项费用 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">单项费用</span>
                        <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => {
                          const newDays = [...dailyExpenses];
                          newDays[dayIdx] = { ...day, singleItems: [...day.singleItems, { id: Date.now().toString(), name: '', price: 0, count: 1, totalPrice: 0 }] };
                          updateData({ dailyExpenses: newDays });
                        }}><Plus className="w-3 h-3" /></Button>
                      </div>
                      {day.singleItems.map((item, itemIdx) => (
                        <div key={item.id} className="flex gap-1 items-center text-xs">
                          <Input placeholder="名称" className="h-6 flex-1 text-xs px-1.5" value={item.name} onChange={(e) => {
                            const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], name: e.target.value };
                            newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays });
                          }} />
                          <div className="flex items-center gap-0.5">
                            <Input type="number" placeholder="单价" className="h-6 w-14 text-xs px-1" value={item.price} onChange={(e) => {
                              const newDays = [...dailyExpenses]; const items = [...day.singleItems]; const price = parseFloat(e.target.value) || 0;
                              items[itemIdx] = { ...items[itemIdx], price, totalPrice: price * items[itemIdx].count };
                              newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays });
                            }} />
                            <span className="text-gray-400 w-4">元</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Input type="number" placeholder="数" className="h-6 w-10 text-xs px-1" value={item.count} onChange={(e) => {
                              const newDays = [...dailyExpenses]; const items = [...day.singleItems]; const count = parseInt(e.target.value) || 1;
                              items[itemIdx] = { ...items[itemIdx], count, totalPrice: items[itemIdx].price * count };
                              newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays });
                            }} />
                            <span className="text-gray-400 w-4">个</span>
                          </div>
                          <span className="w-12 text-right font-medium">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600" onClick={() => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, singleItems: day.singleItems.filter((_, i) => i !== itemIdx) };
                            updateData({ dailyExpenses: newDays });
                          }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 其他费用 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-medium">其他费用</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {[
                  { key: 'insurance', label: '保险' },
                  { key: 'serviceFee', label: '服务费' },
                  { key: 'reserveFund', label: '备用金' },
                  { key: 'materialFee', label: '物料' },
                  { key: 'giftFee', label: '礼品' },
                  { key: 'other', label: '其他' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-0.5">
                    <span className="text-gray-400">{label}</span>
                    <Input type="number" min="0" step="0.01" className={numInputMid} value={otherExpenses[key as keyof typeof otherExpenses]} 
                      onChange={(e) => updateData({ otherExpenses: { ...otherExpenses, [key]: parseFloat(e.target.value) || 0 } })} />
                    <span className="text-gray-400 w-6">元</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：成本表和报价单 */}
        <div className="w-80 flex-shrink-0 space-y-3 sticky top-14 self-start">
          {/* 成本表 - 自己看的 */}
          <Card className="shadow-sm border-slate-200 bg-slate-50/50">
            <CardHeader className="py-2 px-3 bg-slate-100/50">
              <CardTitle className="text-sm font-medium text-slate-700">成本核算表</CardTitle>
              <p className="text-xs text-slate-500">内部参考</p>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">住宿费</span>
                  <span className="font-medium">{formatMoney(summary.totalAccommodation)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">用餐费</span>
                  <span className="font-medium">{formatMoney(summary.totalMeal)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">交通费</span>
                  <span className="font-medium">{formatMoney(summary.totalBus)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">工作人员</span>
                  <span className="font-medium">{formatMoney(summary.totalStaffFee)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">单项费用</span>
                  <span className="font-medium">{formatMoney(summary.totalSingleItems)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">团队费用</span>
                  <span className="font-medium">{formatMoney(summary.totalTeamExpenses)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-gray-600">其他费用</span>
                  <span className="font-medium">{formatMoney(summary.totalOtherExpenses)}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-slate-100/50 rounded mt-1 px-1">
                  <span className="font-semibold text-slate-700">总成本</span>
                  <span className="font-bold text-slate-700 text-base">{formatMoney(summary.totalCost)}</span>
                </div>
                <div className="flex justify-between py-1 text-gray-500">
                  <span>人均成本</span>
                  <span className="font-medium">{formatMoney(summary.avgCostPerClient)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 报价单 - 给客户看的 */}
          <Card className="shadow-sm border-green-200 bg-green-50/50">
            <CardHeader className="py-2 px-3 bg-green-100/50">
              <CardTitle className="text-sm font-medium text-green-700">报价单</CardTitle>
              <p className="text-xs text-green-600">给客户展示</p>
            </CardHeader>
            <CardContent className="pt-2 pb-3 px-3">
              <div className="space-y-1 text-xs">
                {/* 费用明细 */}
                {summary.totalAccommodation > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">住宿费</span>
                    <span className="font-medium">{formatMoney(summary.totalAccommodation)}</span>
                  </div>
                )}
                {summary.totalMeal > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">用餐费</span>
                    <span className="font-medium">{formatMoney(summary.totalMeal)}</span>
                  </div>
                )}
                {summary.totalBus > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">交通费</span>
                    <span className="font-medium">{formatMoney(summary.totalBus)}</span>
                  </div>
                )}
                
                {/* 单项费用列表 */}
                {allSingleItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">{item.name || `项目${idx + 1}`}</span>
                    <span className="font-medium">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
                
                {/* 团队费用 */}
                {summary.totalTeamExpenses > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">活动费用</span>
                    <span className="font-medium">{formatMoney(summary.totalTeamExpenses)}</span>
                  </div>
                )}
                
                {/* 保险 */}
                {otherExpenses.insurance > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">保险费</span>
                    <span className="font-medium">{formatMoney(otherExpenses.insurance)}</span>
                  </div>
                )}
                
                {/* 物料 */}
                {otherExpenses.materialFee > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">物料费</span>
                    <span className="font-medium">{formatMoney(otherExpenses.materialFee)}</span>
                  </div>
                )}
                
                {/* 礼品 */}
                {otherExpenses.giftFee > 0 && (
                  <div className="flex justify-between py-0.5 border-b border-green-100">
                    <span className="text-gray-600">礼品费</span>
                    <span className="font-medium">{formatMoney(otherExpenses.giftFee)}</span>
                  </div>
                )}
                
                {/* 小计 */}
                <div className="flex justify-between py-0.5 bg-green-100/30 rounded px-1 mt-1">
                  <span className="text-gray-600">小计</span>
                  <span className="font-medium">{formatMoney(summary.totalCost)}</span>
                </div>
                
                {/* 服务费 */}
                <div className="flex justify-between py-0.5 border-b border-green-100">
                  <span className="text-gray-600">服务费 (10%)</span>
                  <span className="font-medium">{formatMoney(serviceFee)}</span>
                </div>
                
                {/* 税费 */}
                <div className="flex justify-between py-0.5 border-b border-green-100">
                  <span className="text-gray-600">税费 (6%)</span>
                  <span className="font-medium">{formatMoney(tax)}</span>
                </div>
                
                {/* 报价合计 */}
                <div className="flex justify-between py-1 bg-green-100/50 rounded mt-1 px-1">
                  <span className="font-semibold text-green-700">报价合计</span>
                  <span className="font-bold text-green-700 text-base">{formatMoney(totalPrice)}</span>
                </div>
                
                {/* 优惠 */}
                <div className="flex justify-between items-center py-0.5 border-b border-green-100">
                  <span className="text-gray-600">优惠</span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-gray-400">-</span>
                    <Input 
                      type="number" 
                      min="0" 
                      step="0.01"
                      className="h-6 w-16 text-xs px-1 text-right" 
                      value={discount} 
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                </div>
                
                {/* 优惠后价格 */}
                <div className="flex justify-between py-1.5 bg-green-200/50 rounded mt-1 px-1">
                  <span className="font-bold text-green-800">应付金额</span>
                  <span className="font-bold text-green-800 text-lg">{formatMoney(finalPrice)}</span>
                </div>
                
                {/* 人均价格 */}
                <div className="flex justify-between py-1 text-gray-500">
                  <span>人均费用</span>
                  <span className="font-medium text-green-600">{formatMoney(pricePerClient)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 人员统计 */}
          <Card className="shadow-sm">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm font-medium">人员统计</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{totalClients}</div>
                  <div className="text-gray-500">客户人数</div>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{totalStaff}</div>
                  <div className="text-gray-500">工作人员</div>
                </div>
                <div className="bg-purple-50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-purple-600">{totalPeople}</div>
                  <div className="text-gray-500">总人数</div>
                </div>
                <div className="bg-orange-50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{coreConfig.tripDays}</div>
                  <div className="text-gray-500">行程天数</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
