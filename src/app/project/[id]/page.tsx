'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProjectData, ProjectType, PROJECT_TYPE_LABELS, DEFAULT_STAFF_FEES } from '@/types';
import { getProjectData, updateProjectData } from '@/lib/storage';
import { calculateCostSummary, formatMoney } from '@/lib/calculation';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState({ basic: true, daily: true, other: true, summary: true });

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
    const lines = [
      '═'.repeat(50), '研学旅行成本核算报告', '═'.repeat(50),
      `项目名称：${projectData.project.name}`,
      `项目类型：${PROJECT_TYPE_LABELS[projectData.project.type]}`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '', '─'.repeat(50), '人员统计', '─'.repeat(50),
      `客户：${summary.totalClients}人`, `工作人员：${summary.totalStaff}人`,
      '', '─'.repeat(50), '费用明细', '─'.repeat(50),
      `住宿费用：${formatMoney(summary.totalAccommodation)}`,
      `用餐费用：${formatMoney(summary.totalMeal)}`,
      `交通费用：${formatMoney(summary.totalBus)}`,
      `工作人员费用：${formatMoney(summary.totalStaffFee)}`,
      `单项费用：${formatMoney(summary.totalSingleItems)}`,
      `团队费用：${formatMoney(summary.totalTeamExpenses)}`,
      `其他费用：${formatMoney(summary.totalOtherExpenses)}`,
      '', '═'.repeat(50),
      `总成本：${formatMoney(summary.totalCost)}`,
      `人均成本：${formatMoney(summary.avgCostPerClient)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.project.name}-成本核算报告.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!projectData) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div></div>;

  const { coreConfig, dailyExpenses, otherExpenses } = projectData;
  const summary = calculateCostSummary(projectData);
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = coreConfig.staffCounts.guide + coreConfig.staffCounts.photographer + coreConfig.staffCounts.videographer + coreConfig.staffCounts.driver;

  // 确保每日数据长度正确
  if (dailyExpenses.length !== coreConfig.tripDays) {
    const newData = Array.from({ length: coreConfig.tripDays }, (_, i) => 
      dailyExpenses[i] || { day: i + 1, accommodation: 0, meal: 0, staffFees: { ...DEFAULT_STAFF_FEES }, singleItems: [], teamExpenses: 0 }
    );
    updateData({ dailyExpenses: newData });
  }

  const toggleSection = (key: keyof typeof openSections) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // 小数字输入框样式
  const numInput = "h-7 w-16 text-sm px-2";
  const numInputMid = "h-7 w-24 text-sm px-2";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部固定栏 */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Input value={projectData.project.name} onChange={(e) => updateData({ project: { ...projectData.project, name: e.target.value } })}
                className="text-base font-semibold border-0 p-0 h-auto w-40 focus-visible:ring-0" />
              <Badge className="text-xs">{PROJECT_TYPE_LABELS[projectData.project.type]}</Badge>
              <span className="text-xs text-gray-500 ml-2">总 <span className="font-semibold text-blue-600">{formatMoney(summary.totalCost)}</span> | 人均 <span className="font-semibold text-green-600">{formatMoney(summary.avgCostPerClient)}</span></span>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleExport}><Download className="w-3 h-3 mr-1" />导出</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}><Save className="w-3 h-3 mr-1" />{isSaving ? '保存中' : '保存'}</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-2 space-y-2">
        {/* 基础信息 */}
        <Collapsible open={openSections.basic} onOpenChange={() => toggleSection('basic')}>
          <Card className="shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-2 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">基础信息</CardTitle>
                  {openSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-3 space-y-2">
                {/* 行程设置 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="text-gray-500">类型</span>
                  <Select value={projectData.project.type} onValueChange={(v: ProjectType) => updateData({ project: { ...projectData.project, type: v } })}>
                    <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="half-day">半日</SelectItem>
                      <SelectItem value="one-day">一日</SelectItem>
                      <SelectItem value="multi-day">多日</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-gray-500">天数</span>
                  <Input type="number" min="1" className={numInput} value={coreConfig.tripDays} onChange={(e) => {
                    const days = parseInt(e.target.value) || 1;
                    updateData({ coreConfig: { ...coreConfig, tripDays: days, accommodationDays: days > 1 ? days - 1 : 0 } });
                  }} />
                  <span className="text-gray-500">住宿天</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.accommodationDays} onChange={(e) => updateData({ coreConfig: { ...coreConfig, accommodationDays: parseInt(e.target.value) || 0 } })} />
                </div>

                <Separator className="my-1" />

                {/* 人员 - 客户 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-500">客户:</span>
                  <span className="text-gray-400">学生</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.studentCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, studentCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400">家长</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.parentCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, parentCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400">老师</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.teacherCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, teacherCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-blue-600 font-medium">共{totalClients}人</span>
                </div>

                {/* 人员 - 工作人员 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-500">工作人员:</span>
                  <span className="text-gray-400">导游</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.guide} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, guide: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400">摄影</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.photographer} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, photographer: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400">摄像</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.videographer} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, videographer: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-gray-400">司机</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.staffCounts.driver} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, driver: parseInt(e.target.value) || 0 } } })} />
                  <span className="text-green-600 font-medium">共{totalStaff}人</span>
                </div>

                <Separator className="my-1" />

                {/* 费用配置 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-500">住宿:</span>
                  <span className="text-gray-400">房单价</span>
                  <Input type="number" min="0" step="0.01" className={numInputMid} value={coreConfig.roomPrice} onChange={(e) => updateData({ coreConfig: { ...coreConfig, roomPrice: parseFloat(e.target.value) || 0 } })} />
                  <span className="text-gray-400">房间数</span>
                  <Input type="number" min="0" className={numInput} value={coreConfig.roomCount} onChange={(e) => updateData({ coreConfig: { ...coreConfig, roomCount: parseInt(e.target.value) || 0 } })} />
                  <span className="text-purple-600 font-medium">住宿费 {formatMoney(coreConfig.roomPrice * coreConfig.roomCount * coreConfig.accommodationDays)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-500">用餐:</span>
                  <span className="text-gray-400">餐标</span>
                  <Input type="number" min="0" step="0.01" className={numInputMid} value={coreConfig.mealStandard} onChange={(e) => updateData({ coreConfig: { ...coreConfig, mealStandard: parseFloat(e.target.value) || 0 } })} />
                  <span className="text-gray-400">日餐数</span>
                  <Input type="number" min="0" max="5" className={numInput} value={coreConfig.mealCountPerDay} onChange={(e) => updateData({ coreConfig: { ...coreConfig, mealCountPerDay: parseInt(e.target.value) || 0 } })} />
                  <span className="text-gray-400">大巴全程</span>
                  <Input type="number" min="0" step="0.01" className={numInputMid} value={coreConfig.busFee} onChange={(e) => updateData({ coreConfig: { ...coreConfig, busFee: parseFloat(e.target.value) || 0 } })} />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 每日费用 */}
        <Collapsible open={openSections.daily} onOpenChange={() => toggleSection('daily')}>
          <Card className="shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-2 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">每日费用</CardTitle>
                  {openSections.daily ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-3 space-y-2">
                {dailyExpenses.slice(0, coreConfig.tripDays).map((day, dayIdx) => {
                  const dayTotal = day.accommodation + day.meal + 
                    (day.staffFees.guide * coreConfig.staffCounts.guide + day.staffFees.photographer * coreConfig.staffCounts.photographer + day.staffFees.videographer * coreConfig.staffCounts.videographer + day.staffFees.driver * coreConfig.staffCounts.driver) +
                    day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0) + day.teamExpenses;
                  
                  return (
                    <div key={day.day} className="border rounded p-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className="text-xs h-5">D{day.day}</Badge>
                        <span className="font-semibold text-blue-600">¥{dayTotal.toFixed(0)}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="text-gray-400">住宿</span>
                        <Input type="number" min="0" step="0.01" className={numInput} value={day.accommodation} onChange={(e) => {
                          const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, accommodation: parseFloat(e.target.value) || 0 }; updateData({ dailyExpenses: newDays });
                        }} />
                        <span className="text-gray-400">用餐</span>
                        <Input type="number" min="0" step="0.01" className={numInput} value={day.meal} onChange={(e) => {
                          const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, meal: parseFloat(e.target.value) || 0 }; updateData({ dailyExpenses: newDays });
                        }} />
                        <span className="text-gray-400">团队</span>
                        <Input type="number" min="0" step="0.01" className={numInput} value={day.teamExpenses} onChange={(e) => {
                          const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, teamExpenses: parseFloat(e.target.value) || 0 }; updateData({ dailyExpenses: newDays });
                        }} />
                        {coreConfig.staffCounts.guide > 0 && <>
                          <span className="text-gray-400">导游薪</span>
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.guide} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, guide: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                        </>}
                        {coreConfig.staffCounts.photographer > 0 && <>
                          <span className="text-gray-400">摄影薪</span>
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.photographer} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, photographer: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                        </>}
                        {coreConfig.staffCounts.videographer > 0 && <>
                          <span className="text-gray-400">摄像薪</span>
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.videographer} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, videographer: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
                        </>}
                        {coreConfig.staffCounts.driver > 0 && <>
                          <span className="text-gray-400">司机薪</span>
                          <Input type="number" min="0" step="0.01" className={numInput} value={day.staffFees.driver} onChange={(e) => {
                            const newDays = [...dailyExpenses]; newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, driver: parseFloat(e.target.value) || 0 } }; updateData({ dailyExpenses: newDays });
                          }} />
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
                          <div key={item.id} className="flex gap-1 items-center">
                            <Input placeholder="名称" className="h-7 flex-1 text-xs px-2" value={item.name} onChange={(e) => {
                              const newDays = [...dailyExpenses]; const items = [...day.singleItems]; items[itemIdx] = { ...items[itemIdx], name: e.target.value };
                              newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays });
                            }} />
                            <Input type="number" placeholder="单价" className="h-7 w-16 text-xs px-1" value={item.price} onChange={(e) => {
                              const newDays = [...dailyExpenses]; const items = [...day.singleItems]; const price = parseFloat(e.target.value) || 0;
                              items[itemIdx] = { ...items[itemIdx], price, totalPrice: price * items[itemIdx].count };
                              newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays });
                            }} />
                            <Input type="number" placeholder="数" className="h-7 w-12 text-xs px-1" value={item.count} onChange={(e) => {
                              const newDays = [...dailyExpenses]; const items = [...day.singleItems]; const count = parseInt(e.target.value) || 1;
                              items[itemIdx] = { ...items[itemIdx], count, totalPrice: items[itemIdx].price * count };
                              newDays[dayIdx] = { ...day, singleItems: items }; updateData({ dailyExpenses: newDays });
                            }} />
                            <span className="text-xs w-12 text-right">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => {
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
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 其他费用 */}
        <Collapsible open={openSections.other} onOpenChange={() => toggleSection('other')}>
          <Card className="shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-2 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">其他费用</CardTitle>
                  {openSections.other ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {[
                    { key: 'insurance', label: '保险' },
                    { key: 'serviceFee', label: '服务费' },
                    { key: 'reserveFund', label: '备用金' },
                    { key: 'materialFee', label: '物料' },
                    { key: 'giftFee', label: '礼品' },
                    { key: 'other', label: '其他' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-gray-400">{label}</span>
                      <Input type="number" min="0" step="0.01" className={numInputMid} value={otherExpenses[key as keyof typeof otherExpenses]} 
                        onChange={(e) => updateData({ otherExpenses: { ...otherExpenses, [key]: parseFloat(e.target.value) || 0 } })} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-600">其他费用合计：<span className="font-semibold">{formatMoney(summary.totalOtherExpenses)}</span></div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 费用汇总 */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 shadow-sm">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm font-medium">费用汇总</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-3">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-2">
              <div className="flex justify-between"><span className="text-gray-500">住宿</span><span>{formatMoney(summary.totalAccommodation)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">用餐</span><span>{formatMoney(summary.totalMeal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">交通</span><span>{formatMoney(summary.totalBus)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">工作人员</span><span>{formatMoney(summary.totalStaffFee)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">单项</span><span>{formatMoney(summary.totalSingleItems)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">团队</span><span>{formatMoney(summary.totalTeamExpenses)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">其他</span><span>{formatMoney(summary.totalOtherExpenses)}</span></div>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <div><span className="text-xs text-gray-500">总成本</span><div className="text-lg font-bold text-blue-600">{formatMoney(summary.totalCost)}</div></div>
              <div className="text-right"><span className="text-xs text-gray-500">人均成本</span><div className="text-lg font-bold text-green-600">{formatMoney(summary.avgCostPerClient)}</div></div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
