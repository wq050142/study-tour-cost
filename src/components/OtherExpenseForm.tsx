'use client';

import { OtherExpense } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OtherExpenseFormProps {
  data: OtherExpense;
  onChange: (data: OtherExpense) => void;
}

export function OtherExpenseForm({ data, onChange }: OtherExpenseFormProps) {
  const handleChange = (field: keyof OtherExpense, value: number) => {
    onChange({ ...data, [field]: value });
  };

  const totalOther = 
    data.insurance + 
    data.serviceFee + 
    data.reserveFund + 
    data.materialFee + 
    data.giftFee + 
    data.other;

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50">
        <CardContent className="pt-4">
          <p className="text-sm text-gray-600">
            💡 提示：填写行程中产生的其他杂项费用，保险费建议按总人数×天数×单价计算后填写总额。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>保险费用</CardTitle>
          <CardDescription>旅行意外险等保险费用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="insurance">保险费用总额（元）</Label>
            <Input
              id="insurance"
              type="number"
              min="0"
              step="0.01"
              value={data.insurance || ''}
              onChange={(e) => handleChange('insurance', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-gray-500">建议计算方式：总人数 × 天数 × 保险单价</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>服务费用</CardTitle>
          <CardDescription>综合服务费、管理费等</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="serviceFee">服务费用（元）</Label>
            <Input
              id="serviceFee"
              type="number"
              min="0"
              step="0.01"
              value={data.serviceFee || ''}
              onChange={(e) => handleChange('serviceFee', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>备用金</CardTitle>
          <CardDescription>应急备用资金</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="reserveFund">备用金（元）</Label>
            <Input
              id="reserveFund"
              type="number"
              min="0"
              step="0.01"
              value={data.reserveFund || ''}
              onChange={(e) => handleChange('reserveFund', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-gray-500">用于处理突发情况或临时支出</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>物料费用</CardTitle>
          <CardDescription>研学手册、活动道具、旗帜等</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="materialFee">物料费用（元）</Label>
            <Input
              id="materialFee"
              type="number"
              min="0"
              step="0.01"
              value={data.materialFee || ''}
              onChange={(e) => handleChange('materialFee', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>礼品费用</CardTitle>
          <CardDescription>纪念品、奖品、礼品等</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="giftFee">礼品费用（元）</Label>
            <Input
              id="giftFee"
              type="number"
              min="0"
              step="0.01"
              value={data.giftFee || ''}
              onChange={(e) => handleChange('giftFee', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>其他费用</CardTitle>
          <CardDescription>未包含在上述类别的其他费用</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="other">其他费用（元）</Label>
            <Input
              id="other"
              type="number"
              min="0"
              step="0.01"
              value={data.other || ''}
              onChange={(e) => handleChange('other', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      {/* 汇总 */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">其他费用总计</div>
              <div className="text-2xl font-bold text-green-600">¥{totalOther.toFixed(2)}</div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div>保险: ¥{data.insurance.toFixed(2)}</div>
              <div>服务费: ¥{data.serviceFee.toFixed(2)}</div>
              <div>备用金: ¥{data.reserveFund.toFixed(2)}</div>
              <div>物料: ¥{data.materialFee.toFixed(2)}</div>
              <div>礼品: ¥{data.giftFee.toFixed(2)}</div>
              <div>其他: ¥{data.other.toFixed(2)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
