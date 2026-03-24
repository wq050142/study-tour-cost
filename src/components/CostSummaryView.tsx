'use client';

import { ProjectData, CostSummary } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, TrendingUp, Users, Calendar, Hotel, Utensils, Bus, UserCheck, Package, FileText } from 'lucide-react';
import { formatMoney } from '@/lib/calculation';

interface CostSummaryViewProps {
  projectData: ProjectData;
  summary: CostSummary;
}

export function CostSummaryView({ projectData, summary }: CostSummaryViewProps) {
  const handleExport = () => {
    // 生成成本报表文本
    const report = generateReport();
    
    // 创建Blob并下载
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectData.project.name}-成本核算报告.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateReport = () => {
    const lines = [
      '═'.repeat(50),
      '研学旅行成本核算报告',
      '═'.repeat(50),
      '',
      `项目名称：${projectData.project.name}`,
      `项目类型：${projectData.project.type === 'half-day' ? '半日' : projectData.project.type === 'one-day' ? '一日' : '多日'}`,
      `核算日期：${new Date().toLocaleDateString()}`,
      '',
      '─'.repeat(50),
      '一、人员统计',
      '─'.repeat(50),
      `客户总人数：${summary.totalClients} 人`,
      `  - 学生：${projectData.coreConfig.studentCount} 人`,
      `  - 家长：${projectData.coreConfig.parentCount} 人`,
      `  - 老师：${projectData.coreConfig.teacherCount} 人`,
      '',
      `工作人员：${summary.totalStaff} 人`,
      `  - 领队导游：${projectData.coreConfig.staffCounts.guide} 人`,
      `  - 摄影师：${projectData.coreConfig.staffCounts.photographer} 人`,
      `  - 摄像师：${projectData.coreConfig.staffCounts.videographer} 人`,
      `  - 司机：${projectData.coreConfig.staffCounts.driver} 人`,
      '',
      `总人数：${summary.totalClients + summary.totalStaff} 人`,
      '',
      '─'.repeat(50),
      '二、费用明细',
      '─'.repeat(50),
      `1. 住宿费用：${formatMoney(summary.totalAccommodation)}`,
      `   计算：${projectData.coreConfig.roomCount}间 × ¥${projectData.coreConfig.roomPrice}/晚 × ${projectData.coreConfig.accommodationDays}晚`,
      '',
      `2. 用餐费用：${formatMoney(summary.totalMeal)}`,
      `   餐标：¥${projectData.coreConfig.mealStandard}/人/餐`,
      '',
      `3. 交通费用：${formatMoney(summary.totalBus)}`,
      `   包车费：¥${projectData.coreConfig.busFee}/天 × ${projectData.coreConfig.tripDays}天`,
      '',
      `4. 工作人员费用：${formatMoney(summary.totalStaffFee)}`,
      `5. 单项费用：${formatMoney(summary.totalSingleItems)}`,
      `6. 团队费用：${formatMoney(summary.totalTeamExpenses)}`,
      `7. 其他费用：${formatMoney(summary.totalOtherExpenses)}`,
      `   - 保险费：${formatMoney(projectData.otherExpenses.insurance)}`,
      `   - 服务费：${formatMoney(projectData.otherExpenses.serviceFee)}`,
      `   - 备用金：${formatMoney(projectData.otherExpenses.reserveFund)}`,
      `   - 物料费：${formatMoney(projectData.otherExpenses.materialFee)}`,
      `   - 礼品费：${formatMoney(projectData.otherExpenses.giftFee)}`,
      `   - 其他：${formatMoney(projectData.otherExpenses.other)}`,
      '',
      '─'.repeat(50),
      '三、每日费用明细',
      '─'.repeat(50),
    ];

    summary.dailyBreakdown.forEach(day => {
      lines.push(`第${day.day}天：`);
      lines.push(`  住宿：${formatMoney(day.accommodation)}`);
      lines.push(`  用餐：${formatMoney(day.meal)}`);
      lines.push(`  工作人员：${formatMoney(day.staffFee)}`);
      lines.push(`  单项：${formatMoney(day.singleItems)}`);
      lines.push(`  团队：${formatMoney(day.teamExpenses)}`);
      lines.push(`  小计：${formatMoney(day.dailyTotal)}`);
      lines.push('');
    });

    lines.push(
      '═'.repeat(50),
      '四、成本汇总',
      '═'.repeat(50),
      `总成本：${formatMoney(summary.totalCost)}`,
      `人均成本：${formatMoney(summary.avgCostPerClient)}`,
      '',
      '═'.repeat(50),
      `备注：${projectData.project.remark || '无'}`,
      '═'.repeat(50),
    );

    return lines.join('\n');
  };

  const costItems = [
    {
      label: '住宿费用',
      value: summary.totalAccommodation,
      icon: Hotel,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: '用餐费用',
      value: summary.totalMeal,
      icon: Utensils,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: '交通费用',
      value: summary.totalBus,
      icon: Bus,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      label: '工作人员费用',
      value: summary.totalStaffFee,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: '单项费用',
      value: summary.totalSingleItems,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '团队费用',
      value: summary.totalTeamExpenses,
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      label: '其他费用',
      value: summary.totalOtherExpenses,
      icon: FileText,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 总览卡片 */}
      <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90">总成本</div>
              <div className="text-4xl font-bold mt-1">{formatMoney(summary.totalCost)}</div>
            </div>
            <Button variant="secondary" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              导出报告
            </Button>
          </div>
          <Separator className="my-4 bg-white/20" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm opacity-90">客户人数</div>
              <div className="text-xl font-semibold">{summary.totalClients} 人</div>
            </div>
            <div>
              <div className="text-sm opacity-90">工作人员</div>
              <div className="text-xl font-semibold">{summary.totalStaff} 人</div>
            </div>
            <div>
              <div className="text-sm opacity-90">行程天数</div>
              <div className="text-xl font-semibold">{projectData.coreConfig.tripDays} 天</div>
            </div>
            <div>
              <div className="text-sm opacity-90">人均成本</div>
              <div className="text-xl font-semibold">{formatMoney(summary.avgCostPerClient)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 费用明细 */}
      <Card>
        <CardHeader>
          <CardTitle>费用明细</CardTitle>
          <CardDescription>各项费用分类汇总</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {costItems.map((item, index) => (
              <div key={index} className={`p-4 rounded-lg ${item.bgColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
                <div className={`text-xl font-bold ${item.color}`}>
                  {formatMoney(item.value)}
                </div>
                {summary.totalCost > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    占比 {((item.value / summary.totalCost) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 每日费用明细 */}
      {summary.dailyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>每日费用明细</CardTitle>
            <CardDescription>按天查看费用分布</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.dailyBreakdown.map((day, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-base">
                      第 {day.day} 天
                    </Badge>
                    <span className="text-lg font-semibold text-blue-600">
                      {formatMoney(day.dailyTotal)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">住宿：</span>
                      <span className="font-medium">{formatMoney(day.accommodation)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">用餐：</span>
                      <span className="font-medium">{formatMoney(day.meal)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">工作人员：</span>
                      <span className="font-medium">{formatMoney(day.staffFee)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">单项：</span>
                      <span className="font-medium">{formatMoney(day.singleItems)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">团队：</span>
                      <span className="font-medium">{formatMoney(day.teamExpenses)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 项目信息 */}
      <Card>
        <CardHeader>
          <CardTitle>项目信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">项目名称：</span>
              <span className="font-medium">{projectData.project.name}</span>
            </div>
            <div>
              <span className="text-gray-500">项目类型：</span>
              <span className="font-medium">
                {projectData.project.type === 'half-day' ? '半日' : 
                 projectData.project.type === 'one-day' ? '一日' : '多日'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">创建时间：</span>
              <span className="font-medium">
                {new Date(projectData.project.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-gray-500">最后更新：</span>
              <span className="font-medium">
                {new Date(projectData.project.updatedAt).toLocaleDateString()}
              </span>
            </div>
            {projectData.project.remark && (
              <div className="col-span-1 md:col-span-2">
                <span className="text-gray-500">备注：</span>
                <span className="font-medium">{projectData.project.remark}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
