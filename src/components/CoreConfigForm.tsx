'use client';

import { CoreConfig, ProjectType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface CoreConfigFormProps {
  data: CoreConfig;
  projectType: ProjectType;
  onChange: (data: CoreConfig) => void;
}

export function CoreConfigForm({ data, projectType, onChange }: CoreConfigFormProps) {
  const handleChange = (field: keyof CoreConfig, value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    onChange({ ...data, [field]: numValue });
  };

  const handleStaffChange = (field: keyof CoreConfig['staffCounts'], value: number) => {
    onChange({
      ...data,
      staffCounts: { ...data.staffCounts, [field]: value },
    });
  };

  // 根据行程天数自动计算住宿天数
  const handleTripDaysChange = (days: number) => {
    const accommodationDays = days > 0 ? days - 1 : 0;
    onChange({ ...data, tripDays: days, accommodationDays });
  };

  const totalClients = data.studentCount + data.parentCount + data.teacherCount;
  const totalStaff = data.staffCounts.guide + data.staffCounts.photographer + 
                    data.staffCounts.videographer + data.staffCounts.driver;

  return (
    <div className="space-y-6">
      {/* 客户人员配置 */}
      <Card>
        <CardHeader>
          <CardTitle>客户人员配置</CardTitle>
          <CardDescription>设置学生、家长和老师的人数</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="studentCount">学生人数</Label>
            <Input
              id="studentCount"
              type="number"
              min="0"
              value={data.studentCount || ''}
              onChange={(e) => handleChange('studentCount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parentCount">家长人数</Label>
            <Input
              id="parentCount"
              type="number"
              min="0"
              value={data.parentCount || ''}
              onChange={(e) => handleChange('parentCount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teacherCount">老师人数</Label>
            <Input
              id="teacherCount"
              type="number"
              min="0"
              value={data.teacherCount || ''}
              onChange={(e) => handleChange('teacherCount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-span-1 md:col-span-3 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-gray-600">客户总人数：</span>
            <span className="font-semibold text-blue-700 ml-2">{totalClients} 人</span>
          </div>
        </CardContent>
      </Card>

      {/* 工作人员配置 */}
      <Card>
        <CardHeader>
          <CardTitle>工作人员配置</CardTitle>
          <CardDescription>设置各工种工作人员人数</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="guideCount">领队导游人数</Label>
            <Input
              id="guideCount"
              type="number"
              min="0"
              value={data.staffCounts.guide || ''}
              onChange={(e) => handleStaffChange('guide', parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photographerCount">摄影师人数</Label>
            <Input
              id="photographerCount"
              type="number"
              min="0"
              value={data.staffCounts.photographer || ''}
              onChange={(e) => handleStaffChange('photographer', parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="videographerCount">摄像师人数</Label>
            <Input
              id="videographerCount"
              type="number"
              min="0"
              value={data.staffCounts.videographer || ''}
              onChange={(e) => handleStaffChange('videographer', parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driverCount">司机人数</Label>
            <Input
              id="driverCount"
              type="number"
              min="0"
              value={data.staffCounts.driver || ''}
              onChange={(e) => handleStaffChange('driver', parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-4 p-3 bg-green-50 rounded-lg">
            <span className="text-sm text-gray-600">工作人员总人数：</span>
            <span className="font-semibold text-green-700 ml-2">{totalStaff} 人</span>
          </div>
        </CardContent>
      </Card>

      {/* 行程信息 */}
      <Card>
        <CardHeader>
          <CardTitle>行程信息</CardTitle>
          <CardDescription>设置行程天数和住宿信息</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tripDays">行程天数</Label>
            <Input
              id="tripDays"
              type="number"
              min="1"
              value={data.tripDays || ''}
              onChange={(e) => handleTripDaysChange(parseInt(e.target.value) || 1)}
              placeholder="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accommodationDays">住宿天数</Label>
            <Input
              id="accommodationDays"
              type="number"
              min="0"
              value={data.accommodationDays || ''}
              onChange={(e) => handleChange('accommodationDays', e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-gray-500">默认为行程天数减1</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotelStar">住宿标准</Label>
            <Select
              value={data.hotelStar.toString()}
              onValueChange={(value) => handleChange('hotelStar', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">一星级</SelectItem>
                <SelectItem value="2">二星级</SelectItem>
                <SelectItem value="3">三星级</SelectItem>
                <SelectItem value="4">四星级</SelectItem>
                <SelectItem value="5">五星级</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 住宿费用 */}
      <Card>
        <CardHeader>
          <CardTitle>住宿费用</CardTitle>
          <CardDescription>设置房间数量和单价</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="roomPrice">房间单价（元/间/晚）</Label>
            <Input
              id="roomPrice"
              type="number"
              min="0"
              step="0.01"
              value={data.roomPrice || ''}
              onChange={(e) => handleChange('roomPrice', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roomCount">房间数量（间）</Label>
            <Input
              id="roomCount"
              type="number"
              min="0"
              value={data.roomCount || ''}
              onChange={(e) => handleChange('roomCount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-span-1 md:col-span-2 p-3 bg-purple-50 rounded-lg">
            <span className="text-sm text-gray-600">住宿总费用：</span>
            <span className="font-semibold text-purple-700 ml-2">
              ¥{(data.roomPrice * data.roomCount * data.accommodationDays).toFixed(2)}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              ({data.roomCount}间 × ¥{data.roomPrice}/晚 × {data.accommodationDays}晚)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 用餐费用 */}
      <Card>
        <CardHeader>
          <CardTitle>用餐费用</CardTitle>
          <CardDescription>设置餐标和用餐次数</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mealStandard">餐标（元/人/餐）</Label>
            <Input
              id="mealStandard"
              type="number"
              min="0"
              step="0.01"
              value={data.mealStandard || ''}
              onChange={(e) => handleChange('mealStandard', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mealCountPerDay">每日用餐次数</Label>
            <Input
              id="mealCountPerDay"
              type="number"
              min="0"
              max="5"
              value={data.mealCountPerDay || ''}
              onChange={(e) => handleChange('mealCountPerDay', e.target.value)}
              placeholder="3"
            />
          </div>
          <div className="col-span-1 md:col-span-2 p-3 bg-orange-50 rounded-lg">
            <span className="text-sm text-gray-600">预估用餐总费用：</span>
            <span className="font-semibold text-orange-700 ml-2">
              ¥{(data.mealStandard * data.mealCountPerDay * data.tripDays * (totalClients + totalStaff)).toFixed(2)}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              ({totalClients + totalStaff}人 × ¥{data.mealStandard}/餐 × {data.mealCountPerDay}餐/天 × {data.tripDays}天)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 交通费用 */}
      <Card>
        <CardHeader>
          <CardTitle>交通费用</CardTitle>
          <CardDescription>设置大巴车包车费用</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="busFee">大巴车包车费用（元/天）</Label>
            <Input
              id="busFee"
              type="number"
              min="0"
              step="0.01"
              value={data.busFee || ''}
              onChange={(e) => handleChange('busFee', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="p-3 bg-cyan-50 rounded-lg">
            <span className="text-sm text-gray-600">交通总费用：</span>
            <span className="font-semibold text-cyan-700 ml-2">
              ¥{(data.busFee * data.tripDays).toFixed(2)}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              (¥{data.busFee}/天 × {data.tripDays}天)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 人员汇总 */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{totalClients}</div>
              <div className="text-sm text-gray-600">客户人数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{totalStaff}</div>
              <div className="text-sm text-gray-600">工作人员</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{data.tripDays}</div>
              <div className="text-sm text-gray-600">行程天数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{totalClients + totalStaff}</div>
              <div className="text-sm text-gray-600">总人数</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
