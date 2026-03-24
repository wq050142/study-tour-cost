'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Download, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProjectData, ProjectType, PROJECT_TYPE_LABELS, DEFAULT_STAFF_FEES, SingleItem, DailyExpense } from '@/types';
import { getProjectData, updateProjectData } from '@/lib/storage';
import { calculateCostSummary, formatMoney } from '@/lib/calculation';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState({
    basic: true,
    daily: true,
    other: true,
    summary: true,
  });

  useEffect(() => {
    const data = getProjectData(id);
    if (data) {
      setProjectData(data);
    } else {
      alert('项目不存在');
      router.push('/');
    }
  }, [id, router]);

  const updateData = (updates: Partial<ProjectData>) => {
    if (!projectData) return;
    setProjectData({ ...projectData, ...updates });
  };

  const handleSave = () => {
    if (!projectData) return;
    setIsSaving(true);
    updateProjectData(projectData);
    setTimeout(() => {
      setIsSaving(false);
      alert('保存成功！');
    }, 300);
  };

  const handleExport = () => {
    if (!projectData) return;
    const summary = calculateCostSummary(projectData);
    const lines = [
      '═'.repeat(50),
      '研学旅行成本核算报告',
      '═'.repeat(50),
      `项目名称：${projectData.project.name}`,
      `项目类型：${PROJECT_TYPE_LABELS[projectData.project.type]}`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '',
      '─'.repeat(50),
      '人员统计',
      '─'.repeat(50),
      `客户：${summary.totalClients}人（学生${projectData.coreConfig.studentCount}+家长${projectData.coreConfig.parentCount}+老师${projectData.coreConfig.teacherCount}）`,
      `工作人员：${summary.totalStaff}人`,
      '',
      '─'.repeat(50),
      '费用明细',
      '─'.repeat(50),
      `住宿费用：${formatMoney(summary.totalAccommodation)}`,
      `用餐费用：${formatMoney(summary.totalMeal)}`,
      `交通费用：${formatMoney(summary.totalBus)}`,
      `工作人员费用：${formatMoney(summary.totalStaffFee)}`,
      `单项费用：${formatMoney(summary.totalSingleItems)}`,
      `团队费用：${formatMoney(summary.totalTeamExpenses)}`,
      `其他费用：${formatMoney(summary.totalOtherExpenses)}`,
      '',
      '═'.repeat(50),
      `总成本：${formatMoney(summary.totalCost)}`,
      `人均成本：${formatMoney(summary.avgCostPerClient)}`,
      '═'.repeat(50),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.project.name}-成本核算报告.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!projectData) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  const { coreConfig, dailyExpenses, otherExpenses } = projectData;
  const summary = calculateCostSummary(projectData);
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = coreConfig.staffCounts.guide + coreConfig.staffCounts.photographer + coreConfig.staffCounts.videographer + coreConfig.staffCounts.driver;

  // 确保每日数据长度正确
  const ensureDailyData = () => {
    if (dailyExpenses.length !== coreConfig.tripDays) {
      const newData = Array.from({ length: coreConfig.tripDays }, (_, i) => 
        dailyExpenses[i] || { day: i + 1, accommodation: 0, meal: 0, staffFees: { ...DEFAULT_STAFF_FEES }, singleItems: [], teamExpenses: 0 }
      );
      updateData({ dailyExpenses: newData });
    }
  };
  ensureDailyData();

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部固定栏 */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Input
                    value={projectData.project.name}
                    onChange={(e) => updateData({ project: { ...projectData.project, name: e.target.value } })}
                    className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                  />
                  <Badge>{PROJECT_TYPE_LABELS[projectData.project.type]}</Badge>
                </div>
                <div className="text-sm text-gray-500">
                  总成本 <span className="font-semibold text-blue-600">{formatMoney(summary.totalCost)}</span>
                  <span className="mx-2">|</span>
                  人均 <span className="font-semibold text-green-600">{formatMoney(summary.avgCostPerClient)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" />导出
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-1" />{isSaving ? '保存中' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* 基础信息 */}
        <Collapsible open={openSections.basic} onOpenChange={() => toggleSection('basic')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">基础信息</CardTitle>
                  {openSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* 项目类型 */}
                <div className="flex items-center gap-4">
                  <Label className="w-20">项目类型</Label>
                  <Select value={projectData.project.type} onValueChange={(v: ProjectType) => updateData({ project: { ...projectData.project, type: v } })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="half-day">半日</SelectItem>
                      <SelectItem value="one-day">一日</SelectItem>
                      <SelectItem value="multi-day">多日</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="w-20">行程天数</Label>
                  <Input type="number" min="1" className="w-20" value={coreConfig.tripDays} onChange={(e) => {
                    const days = parseInt(e.target.value) || 1;
                    updateData({ coreConfig: { ...coreConfig, tripDays: days, accommodationDays: days > 1 ? days - 1 : 0 } });
                  }} />
                  <Label className="w-20">住宿天数</Label>
                  <Input type="number" min="0" className="w-20" value={coreConfig.accommodationDays} onChange={(e) => updateData({ coreConfig: { ...coreConfig, accommodationDays: parseInt(e.target.value) || 0 } })} />
                </div>

                <Separator />

                {/* 人员配置 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">学生</Label>
                    <Input type="number" min="0" value={coreConfig.studentCount || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, studentCount: parseInt(e.target.value) || 0 } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">家长</Label>
                    <Input type="number" min="0" value={coreConfig.parentCount || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, parentCount: parseInt(e.target.value) || 0 } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">老师</Label>
                    <Input type="number" min="0" value={coreConfig.teacherCount || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, teacherCount: parseInt(e.target.value) || 0 } })} />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600 pb-2">客户共 <span className="font-semibold text-blue-600">{totalClients}</span> 人</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">导游领队</Label>
                    <Input type="number" min="0" value={coreConfig.staffCounts.guide || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, guide: parseInt(e.target.value) || 0 } } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">摄影师</Label>
                    <Input type="number" min="0" value={coreConfig.staffCounts.photographer || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, photographer: parseInt(e.target.value) || 0 } } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">摄像师</Label>
                    <Input type="number" min="0" value={coreConfig.staffCounts.videographer || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, videographer: parseInt(e.target.value) || 0 } } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">司机</Label>
                    <Input type="number" min="0" value={coreConfig.staffCounts.driver || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, staffCounts: { ...coreConfig.staffCounts, driver: parseInt(e.target.value) || 0 } } })} />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600 pb-2">工作人员 <span className="font-semibold text-green-600">{totalStaff}</span> 人</div>
                  </div>
                </div>

                <Separator />

                {/* 费用配置 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">房间单价(元/晚)</Label>
                    <Input type="number" min="0" step="0.01" value={coreConfig.roomPrice || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, roomPrice: parseFloat(e.target.value) || 0 } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">房间数量</Label>
                    <Input type="number" min="0" value={coreConfig.roomCount || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, roomCount: parseInt(e.target.value) || 0 } })} />
                  </div>
                  <div className="col-span-2 flex items-end">
                    <div className="text-sm text-gray-600 pb-2">住宿费 <span className="font-semibold text-purple-600">{formatMoney(coreConfig.roomPrice * coreConfig.roomCount * coreConfig.accommodationDays)}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">餐标(元/人/餐)</Label>
                    <Input type="number" min="0" step="0.01" value={coreConfig.mealStandard || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, mealStandard: parseFloat(e.target.value) || 0 } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">每日餐数</Label>
                    <Input type="number" min="0" max="5" value={coreConfig.mealCountPerDay || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, mealCountPerDay: parseInt(e.target.value) || 0 } })} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">大巴车费(元/天)</Label>
                    <Input type="number" min="0" step="0.01" value={coreConfig.busFee || ''} onChange={(e) => updateData({ coreConfig: { ...coreConfig, busFee: parseFloat(e.target.value) || 0 } })} />
                  </div>
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600 pb-2">交通费 <span className="font-semibold text-cyan-600">{formatMoney(coreConfig.busFee * coreConfig.tripDays)}</span></div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 每日费用 */}
        <Collapsible open={openSections.daily} onOpenChange={() => toggleSection('daily')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">每日费用</CardTitle>
                  {openSections.daily ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {dailyExpenses.slice(0, coreConfig.tripDays).map((day, dayIdx) => (
                  <div key={day.day} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">第 {day.day} 天</Badge>
                      <span className="text-sm font-semibold text-blue-600">
                        ¥{(
                          day.accommodation + 
                          day.meal + 
                          (day.staffFees.guide * coreConfig.staffCounts.guide + day.staffFees.photographer * coreConfig.staffCounts.photographer + day.staffFees.videographer * coreConfig.staffCounts.videographer + day.staffFees.driver * coreConfig.staffCounts.driver) +
                          day.singleItems.reduce((s, i) => s + (i.totalPrice || i.price * i.count), 0) +
                          day.teamExpenses
                        ).toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500">住宿费</Label>
                        <Input type="number" min="0" step="0.01" value={day.accommodation || ''} onChange={(e) => {
                          const newDays = [...dailyExpenses];
                          newDays[dayIdx] = { ...day, accommodation: parseFloat(e.target.value) || 0 };
                          updateData({ dailyExpenses: newDays });
                        }} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">用餐费</Label>
                        <Input type="number" min="0" step="0.01" value={day.meal || ''} onChange={(e) => {
                          const newDays = [...dailyExpenses];
                          newDays[dayIdx] = { ...day, meal: parseFloat(e.target.value) || 0 };
                          updateData({ dailyExpenses: newDays });
                        }} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">团队费</Label>
                        <Input type="number" min="0" step="0.01" value={day.teamExpenses || ''} onChange={(e) => {
                          const newDays = [...dailyExpenses];
                          newDays[dayIdx] = { ...day, teamExpenses: parseFloat(e.target.value) || 0 };
                          updateData({ dailyExpenses: newDays });
                        }} />
                      </div>
                      {coreConfig.staffCounts.guide > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">导游日薪</Label>
                          <Input type="number" min="0" step="0.01" value={day.staffFees.guide || ''} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, guide: parseFloat(e.target.value) || 0 } };
                            updateData({ dailyExpenses: newDays });
                          }} />
                        </div>
                      )}
                      {coreConfig.staffCounts.photographer > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">摄影师日薪</Label>
                          <Input type="number" min="0" step="0.01" value={day.staffFees.photographer || ''} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, photographer: parseFloat(e.target.value) || 0 } };
                            updateData({ dailyExpenses: newDays });
                          }} />
                        </div>
                      )}
                      {coreConfig.staffCounts.videographer > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">摄像师日薪</Label>
                          <Input type="number" min="0" step="0.01" value={day.staffFees.videographer || ''} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, videographer: parseFloat(e.target.value) || 0 } };
                            updateData({ dailyExpenses: newDays });
                          }} />
                        </div>
                      )}
                      {coreConfig.staffCounts.driver > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">司机日薪</Label>
                          <Input type="number" min="0" step="0.01" value={day.staffFees.driver || ''} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            newDays[dayIdx] = { ...day, staffFees: { ...day.staffFees, driver: parseFloat(e.target.value) || 0 } };
                            updateData({ dailyExpenses: newDays });
                          }} />
                        </div>
                      )}
                    </div>

                    {/* 单项费用 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-gray-500">单项费用</Label>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                          const newDays = [...dailyExpenses];
                          newDays[dayIdx] = { ...day, singleItems: [...day.singleItems, { id: Date.now().toString(), name: '', price: 0, count: 1, totalPrice: 0 }] };
                          updateData({ dailyExpenses: newDays });
                        }}>
                          <Plus className="w-3 h-3 mr-1" />添加
                        </Button>
                      </div>
                      {day.singleItems.map((item, itemIdx) => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <Input placeholder="名称" className="flex-1" value={item.name} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            const items = [...day.singleItems];
                            items[itemIdx] = { ...items[itemIdx], name: e.target.value };
                            newDays[dayIdx] = { ...day, singleItems: items };
                            updateData({ dailyExpenses: newDays });
                          }} />
                          <Input type="number" placeholder="单价" className="w-20" value={item.price || ''} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            const items = [...day.singleItems];
                            const price = parseFloat(e.target.value) || 0;
                            items[itemIdx] = { ...items[itemIdx], price, totalPrice: price * items[itemIdx].count };
                            newDays[dayIdx] = { ...day, singleItems: items };
                            updateData({ dailyExpenses: newDays });
                          }} />
                          <Input type="number" placeholder="数量" className="w-16" value={item.count || ''} onChange={(e) => {
                            const newDays = [...dailyExpenses];
                            const items = [...day.singleItems];
                            const count = parseInt(e.target.value) || 1;
                            items[itemIdx] = { ...items[itemIdx], count, totalPrice: items[itemIdx].price * count };
                            newDays[dayIdx] = { ...day, singleItems: items };
                            updateData({ dailyExpenses: newDays });
                          }} />
                          <span className="text-sm w-16 text-right">¥{(item.totalPrice || item.price * item.count).toFixed(0)}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => {
                            const newDays = [...dailyExpenses];
                            newDays[dayIdx] = { ...day, singleItems: day.singleItems.filter((_, i) => i !== itemIdx) };
                            updateData({ dailyExpenses: newDays });
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 其他费用 */}
        <Collapsible open={openSections.other} onOpenChange={() => toggleSection('other')}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">其他费用</CardTitle>
                  {openSections.other ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'insurance', label: '保险费' },
                    { key: 'serviceFee', label: '服务费' },
                    { key: 'reserveFund', label: '备用金' },
                    { key: 'materialFee', label: '物料费' },
                    { key: 'giftFee', label: '礼品费' },
                    { key: 'other', label: '其他' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs text-gray-500">{label}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={otherExpenses[key as keyof typeof otherExpenses] || ''}
                        onChange={(e) => updateData({ otherExpenses: { ...otherExpenses, [key]: parseFloat(e.target.value) || 0 } })}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  其他费用合计：<span className="font-semibold text-gray-800">{formatMoney(summary.totalOtherExpenses)}</span>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* 费用汇总 */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader className="py-3">
            <CardTitle className="text-base">费用汇总</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">住宿费</span>
                <span className="font-medium">{formatMoney(summary.totalAccommodation)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">用餐费</span>
                <span className="font-medium">{formatMoney(summary.totalMeal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">交通费</span>
                <span className="font-medium">{formatMoney(summary.totalBus)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">工作人员</span>
                <span className="font-medium">{formatMoney(summary.totalStaffFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">单项费</span>
                <span className="font-medium">{formatMoney(summary.totalSingleItems)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">团队费</span>
                <span className="font-medium">{formatMoney(summary.totalTeamExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">其他费</span>
                <span className="font-medium">{formatMoney(summary.totalOtherExpenses)}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between items-center pt-3">
              <div>
                <div className="text-gray-600">总成本</div>
                <div className="text-2xl font-bold text-blue-600">{formatMoney(summary.totalCost)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-600">人均成本</div>
                <div className="text-2xl font-bold text-green-600">{formatMoney(summary.avgCostPerClient)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
