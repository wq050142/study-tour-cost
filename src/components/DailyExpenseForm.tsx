'use client';

import { useState } from 'react';
import { DailyExpense, SingleItem, StaffFeeConfig, DEFAULT_STAFF_FEES } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Hotel, Utensils, Users, Package } from 'lucide-react';

interface DailyExpenseFormProps {
  data: DailyExpense[];
  tripDays: number;
  staffCounts: {
    guide: number;
    photographer: number;
    videographer: number;
    driver: number;
  };
  onChange: (data: DailyExpense[]) => void;
}

export function DailyExpenseForm({ data, tripDays, staffCounts, onChange }: DailyExpenseFormProps) {
  const [expandedDays, setExpandedDays] = useState<string[]>(['day-1']);

  // 确保数据长度与行程天数一致
  const ensureDataLength = () => {
    if (data.length !== tripDays) {
      const newData = Array.from({ length: tripDays }, (_, index) => {
        const existing = data[index];
        return existing || {
          day: index + 1,
          accommodation: 0,
          meal: 0,
          staffFees: { ...DEFAULT_STAFF_FEES },
          singleItems: [],
          teamExpenses: 0,
        };
      });
      onChange(newData);
      return newData;
    }
    return data;
  };

  const currentData = ensureDataLength();

  const handleDayChange = (dayIndex: number, field: keyof DailyExpense, value: number) => {
    const newData = [...currentData];
    newData[dayIndex] = { ...newData[dayIndex], [field]: value };
    onChange(newData);
  };

  const handleStaffFeeChange = (dayIndex: number, field: keyof StaffFeeConfig, value: number) => {
    const newData = [...currentData];
    newData[dayIndex] = {
      ...newData[dayIndex],
      staffFees: { ...newData[dayIndex].staffFees, [field]: value },
    };
    onChange(newData);
  };

  const handleAddSingleItem = (dayIndex: number) => {
    const newData = [...currentData];
    const newItem: SingleItem = {
      id: Date.now().toString(),
      name: '',
      price: 0,
      count: 1,
      totalPrice: 0,
    };
    newData[dayIndex] = {
      ...newData[dayIndex],
      singleItems: [...newData[dayIndex].singleItems, newItem],
    };
    onChange(newData);
  };

  const handleSingleItemChange = (dayIndex: number, itemIndex: number, field: keyof SingleItem, value: string | number) => {
    const newData = [...currentData];
    const items = [...newData[dayIndex].singleItems];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    
    // 自动计算总价
    if (field === 'price' || field === 'count') {
      items[itemIndex].totalPrice = items[itemIndex].price * items[itemIndex].count;
    }
    
    newData[dayIndex] = { ...newData[dayIndex], singleItems: items };
    onChange(newData);
  };

  const handleRemoveSingleItem = (dayIndex: number, itemIndex: number) => {
    const newData = [...currentData];
    const items = newData[dayIndex].singleItems.filter((_, i) => i !== itemIndex);
    newData[dayIndex] = { ...newData[dayIndex], singleItems: items };
    onChange(newData);
  };

  const calculateDayTotal = (day: DailyExpense) => {
    const staffTotal = 
      day.staffFees.guide * staffCounts.guide +
      day.staffFees.photographer * staffCounts.photographer +
      day.staffFees.videographer * staffCounts.videographer +
      day.staffFees.driver * staffCounts.driver;
    
    const itemsTotal = day.singleItems.reduce((sum, item) => sum + (item.totalPrice || item.price * item.count), 0);
    
    return day.accommodation + day.meal + staffTotal + itemsTotal + day.teamExpenses;
  };

  return (
    <div className="space-y-4">
      <Card className="bg-blue-50">
        <CardContent className="pt-4">
          <p className="text-sm text-gray-600">
            💡 提示：请按天填写各项费用，住宿和用餐费用如每天相同可填写在第一天，或留空在汇总时按统一标准计算。
          </p>
        </CardContent>
      </Card>

      <Accordion
        type="multiple"
        value={expandedDays}
        onValueChange={setExpandedDays}
        className="space-y-4"
      >
        {currentData.map((day, dayIndex) => (
          <AccordionItem key={`day-${day.day}`} value={`day-${day.day}`} className="bg-white border rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-base">
                    第 {day.day} 天
                  </Badge>
                  <span className="text-sm text-gray-500">
                    总费用: ¥{calculateDayTotal(day).toFixed(2)}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-6">
                {/* 住宿费用 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Hotel className="w-4 h-4 text-purple-500" />
                      住宿费用
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor={`accommodation-${day.day}`}>当日住宿费用（元）</Label>
                      <Input
                        id={`accommodation-${day.day}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={day.accommodation || ''}
                        onChange={(e) => handleDayChange(dayIndex, 'accommodation', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 用餐费用 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-orange-500" />
                      用餐费用
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor={`meal-${day.day}`}>当日用餐费用（元）</Label>
                      <Input
                        id={`meal-${day.day}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={day.meal || ''}
                        onChange={(e) => handleDayChange(dayIndex, 'meal', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 工作人员费用 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      工作人员日薪
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {staffCounts.guide > 0 && (
                      <div className="space-y-2">
                        <Label>领队导游日薪（元/人）</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={day.staffFees.guide || ''}
                          onChange={(e) => handleStaffFeeChange(dayIndex, 'guide', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500">人数: {staffCounts.guide} 人</p>
                      </div>
                    )}
                    {staffCounts.photographer > 0 && (
                      <div className="space-y-2">
                        <Label>摄影师日薪（元/人）</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={day.staffFees.photographer || ''}
                          onChange={(e) => handleStaffFeeChange(dayIndex, 'photographer', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500">人数: {staffCounts.photographer} 人</p>
                      </div>
                    )}
                    {staffCounts.videographer > 0 && (
                      <div className="space-y-2">
                        <Label>摄像师日薪（元/人）</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={day.staffFees.videographer || ''}
                          onChange={(e) => handleStaffFeeChange(dayIndex, 'videographer', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500">人数: {staffCounts.videographer} 人</p>
                      </div>
                    )}
                    {staffCounts.driver > 0 && (
                      <div className="space-y-2">
                        <Label>司机日薪（元/人）</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={day.staffFees.driver || ''}
                          onChange={(e) => handleStaffFeeChange(dayIndex, 'driver', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500">人数: {staffCounts.driver} 人</p>
                      </div>
                    )}
                    {staffCounts.guide + staffCounts.photographer + staffCounts.videographer + staffCounts.driver === 0 && (
                      <p className="col-span-full text-sm text-gray-500">暂无工作人员，请在核心配置中添加</p>
                    )}
                  </CardContent>
                </Card>

                {/* 单项费用 */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-500" />
                        单项费用
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddSingleItem(dayIndex)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        添加项目
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {day.singleItems.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">暂无单项费用，点击上方按钮添加</p>
                    ) : (
                      <div className="space-y-3">
                        {day.singleItems.map((item, itemIndex) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">项目名称</Label>
                              <Input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleSingleItemChange(dayIndex, itemIndex, 'name', e.target.value)}
                                placeholder="如：门票"
                                className="h-8"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">单价</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price || ''}
                                onChange={(e) => handleSingleItemChange(dayIndex, itemIndex, 'price', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">数量</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.count || ''}
                                onChange={(e) => handleSingleItemChange(dayIndex, itemIndex, 'count', parseInt(e.target.value) || 1)}
                                placeholder="1"
                                className="h-8"
                              />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-xs">总价</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.totalPrice || ''}
                                onChange={(e) => handleSingleItemChange(dayIndex, itemIndex, 'totalPrice', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                                onClick={() => handleRemoveSingleItem(dayIndex, itemIndex)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 团队费用 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">团队费用</CardTitle>
                    <CardDescription>场地租赁、活动组织等一次性费用</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor={`team-${day.day}`}>当日团队费用（元）</Label>
                      <Input
                        id={`team-${day.day}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={day.teamExpenses || ''}
                        onChange={(e) => handleDayChange(dayIndex, 'teamExpenses', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
