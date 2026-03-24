'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Calculator, FileText, Calendar, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectData, PROJECT_TYPE_LABELS } from '@/types';
import { getProjectData, updateProjectData } from '@/lib/storage';
import { calculateCostSummary, formatMoney } from '@/lib/calculation';
import { CoreConfigForm } from '@/components/CoreConfigForm';
import { DailyExpenseForm } from '@/components/DailyExpenseForm';
import { OtherExpenseForm } from '@/components/OtherExpenseForm';
import { CostSummaryView } from '@/components/CostSummaryView';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeTab, setActiveTab] = useState('core');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const data = getProjectData(id);
    if (data) {
      setProjectData(data);
    } else {
      alert('项目不存在');
      router.push('/');
    }
  }, [id, router]);

  const handleSave = () => {
    if (!projectData) return;
    
    setIsSaving(true);
    updateProjectData(projectData);
    
    setTimeout(() => {
      setIsSaving(false);
      alert('保存成功！');
    }, 500);
  };

  const handleCoreConfigChange = (coreConfig: ProjectData['coreConfig']) => {
    if (!projectData) return;
    setProjectData({ ...projectData, coreConfig });
  };

  const handleDailyExpensesChange = (dailyExpenses: ProjectData['dailyExpenses']) => {
    if (!projectData) return;
    setProjectData({ ...projectData, dailyExpenses });
  };

  const handleOtherExpensesChange = (otherExpenses: ProjectData['otherExpenses']) => {
    if (!projectData) return;
    setProjectData({ ...projectData, otherExpenses });
  };

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const costSummary = calculateCostSummary(projectData);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{projectData.project.name}</h1>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    {PROJECT_TYPE_LABELS[projectData.project.type]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  总成本: {formatMoney(costSummary.totalCost)} | 
                  人均: {formatMoney(costSummary.avgCostPerClient)}
                </p>
              </div>
            </div>
            
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              <Save className="w-4 h-4" />
              {isSaving ? '保存中...' : '保存项目'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="core" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">核心配置</span>
            </TabsTrigger>
            <TabsTrigger value="daily" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">每日费用</span>
            </TabsTrigger>
            <TabsTrigger value="other" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">其他费用</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">成本汇总</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="core">
            <CoreConfigForm
              data={projectData.coreConfig}
              projectType={projectData.project.type}
              onChange={handleCoreConfigChange}
            />
          </TabsContent>

          <TabsContent value="daily">
            <DailyExpenseForm
              data={projectData.dailyExpenses}
              tripDays={projectData.coreConfig.tripDays}
              staffCounts={projectData.coreConfig.staffCounts}
              onChange={handleDailyExpensesChange}
            />
          </TabsContent>

          <TabsContent value="other">
            <OtherExpenseForm
              data={projectData.otherExpenses}
              onChange={handleOtherExpensesChange}
            />
          </TabsContent>

          <TabsContent value="summary">
            <CostSummaryView
              projectData={projectData}
              summary={costSummary}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
