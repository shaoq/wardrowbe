'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Save, RotateCcw, Check, Plus, Trash2, ChevronUp, ChevronDown, Server, MapPin, Navigation, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePreferences, useUpdatePreferences, useResetPreferences, useTestAIEndpoint } from '@/lib/hooks/use-preferences';
import { useUserProfile, useUpdateUserProfile } from '@/lib/hooks/use-user';
import { CLOTHING_COLORS, OCCASIONS, Preferences, StyleProfile, AIEndpoint } from '@/lib/types';
import { toF, toCelsius } from '@/lib/temperature';
import { toast } from 'sonner';

const CM_TO_IN = 0.393701;
const IN_TO_CM = 2.54;
const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 0.453592;

function convertMeasurement(value: number, key: string, from: string, to: string): number {
  if (from === to) return value;
  const isWeight = key === 'weight';
  if (from === 'metric' && to === 'imperial') {
    return Math.round((isWeight ? value * KG_TO_LBS : value * CM_TO_IN) * 10) / 10;
  }
  return Math.round((isWeight ? value * LBS_TO_KG : value * IN_TO_CM) * 10) / 10;
}

const BODY_MEASUREMENT_FIELDS = [
  { key: 'height', unitMetric: 'cm', unitImperial: 'in', placeholderMetric: '例如 178', placeholderImperial: '例如 70' },
  { key: 'weight', unitMetric: 'kg', unitImperial: 'lbs', placeholderMetric: '例如 75', placeholderImperial: '例如 165' },
  { key: 'chest', unitMetric: 'cm', unitImperial: 'in', placeholderMetric: '例如 96', placeholderImperial: '例如 38' },
  { key: 'waist', unitMetric: 'cm', unitImperial: 'in', placeholderMetric: '例如 82', placeholderImperial: '例如 32' },
  { key: 'hips', unitMetric: 'cm', unitImperial: 'in', placeholderMetric: '例如 98', placeholderImperial: '例如 39' },
  { key: 'inseam', unitMetric: 'cm', unitImperial: 'in', placeholderMetric: '例如 81', placeholderImperial: '例如 32' },
] as const;

const SIZE_FIELDS = [
  { key: 'shirt_size', label: '衬衫尺码', placeholder: '例如 M, L, XL' },
  { key: 'pants_size', label: '裤子尺码', placeholder: '例如 32, 34' },
  { key: 'dress_size', label: '裙子尺码', placeholder: '例如 8, 10' },
  { key: 'shoe_size', label: '鞋码', placeholder: '例如 10, 42' },
] as const;

function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  return fallback;
}

interface EndpointTestResult {
  status: 'connected' | 'error' | 'testing' | null;
  models?: string[];
  visionModels?: string[];
  textModels?: string[];
  error?: string;
}

function ColorPicker({
  selected,
  onChange,
  label,
}: {
  selected: string[];
  onChange: (colors: string[]) => void;
  label: string;
}) {
  const toggleColor = (color: string) => {
    if (selected.includes(color)) {
      onChange(selected.filter((c) => c !== color));
    } else {
      onChange([...selected, color]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {CLOTHING_COLORS.map((color) => {
          const isSelected = selected.includes(color.value);
          return (
            <button
              key={color.value}
              type="button"
              onClick={() => toggleColor(color.value)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 scale-110'
                  : 'border-muted-foreground/20 hover:border-muted-foreground/40'
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {isSelected && (
                <Check
                  className={`h-4 w-4 mx-auto ${
                    color.value === 'white' || color.value === 'yellow' || color.value === 'beige'
                      ? 'text-black'
                      : 'text-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((color) => {
            const colorInfo = CLOTHING_COLORS.find((c) => c.value === color);
            return (
              <Badge key={color} variant="secondary" className="gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: colorInfo?.hex }}
                />
                {colorInfo?.name}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StyleSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={0}
        max={100}
        step={10}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { data: preferences, isLoading } = usePreferences();
  const { data: userProfile, isLoading: isLoadingProfile } = useUserProfile();
  const updatePreferences = useUpdatePreferences();
  const resetPreferences = useResetPreferences();
  const testEndpoint = useTestAIEndpoint();
  const updateUserProfile = useUpdateUserProfile();

  const [formData, setFormData] = useState<Partial<Preferences>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [endpointTests, setEndpointTests] = useState<Record<number, EndpointTestResult>>({});

  // Location and timezone state
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLon, setLocationLon] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Body measurements state
  type UnitSystem = 'metric' | 'imperial';
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [measurementsDirty, setMeasurementsDirty] = useState(false);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('wardrowbe_unit_system') as UnitSystem) || 'metric';
    }
    return 'metric';
  });


  useEffect(() => {
    if (userProfile) {
      setLocationName(userProfile.location_name || '');
      setLocationLat(userProfile.location_lat?.toString() || '');
      setLocationLon(userProfile.location_lon?.toString() || '');
      setTimezone(userProfile.timezone || 'UTC');

      if (userProfile.body_measurements) {
        const initial: Record<string, string> = {};
        const numericKeys = ['chest', 'waist', 'hips', 'inseam', 'height', 'weight'];
        for (const [key, value] of Object.entries(userProfile.body_measurements)) {
          if (numericKeys.includes(key) && typeof value === 'number') {
            const converted = convertMeasurement(value, key, 'metric', unitSystem);
            initial[key] = String(converted);
          } else {
            initial[key] = String(value);
          }
        }
        setMeasurements(initial);
      }
    }
  }, [userProfile]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('您的浏览器不支持地理定位');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lon = position.coords.longitude.toFixed(6);
        setLocationLat(lat);
        setLocationLon(lon);

        // Reverse geocode to get city name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'User-Agent': 'WardrobeAI/1.0' } }
          );
          if (response.ok) {
            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
            const country = data.address?.country;
            if (city && country) {
              setLocationName(`${city}, ${country}`);
            } else if (city) {
              setLocationName(city);
            } else if (data.display_name) {
              // Fallback to first part of display name
              setLocationName(data.display_name.split(',').slice(0, 2).join(',').trim());
            }
          }
        } catch {
          // Ignore geocoding errors, we still have coordinates
        }

        setIsGettingLocation(false);
        toast.success('已检测到位置');
      },
      (error) => {
        setIsGettingLocation(false);
        toast.error(`获取位置失败: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveLocation = async () => {
    const lat = parseFloat(locationLat);
    const lon = parseFloat(locationLon);

    if (isNaN(lat) || isNaN(lon)) {
      toast.error('请输入有效的经纬度值');
      return;
    }

    if (lat < -90 || lat > 90) {
      toast.error('纬度必须在-90到90之间');
      return;
    }

    if (lon < -180 || lon > 180) {
      toast.error('经度必须在-180到180之间');
      return;
    }

    try {
      await updateUserProfile.mutateAsync({
        location_lat: lat,
        location_lon: lon,
        location_name: locationName || undefined,
        timezone: timezone,
      });
      toast.success('位置和时区已保存');
    } catch {
      toast.error('保存位置失败');
    }
  };

  const hasLocationChanges = userProfile && (
    locationName !== (userProfile.location_name || '') ||
    locationLat !== (userProfile.location_lat?.toString() || '') ||
    locationLon !== (userProfile.location_lon?.toString() || '') ||
    timezone !== (userProfile.timezone || 'UTC')
  );

  const isDirty = hasChanges || measurementsDirty || !!hasLocationChanges;

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);

    const origPush = history.pushState.bind(history);
    history.pushState = function (...args) {
      if (window.confirm('您有未保存的更改。确定要离开此页面吗？')) {
        origPush(...args);
      }
    };

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      history.pushState = origPush;
    };
  }, [isDirty]);

  const handleToggleUnits = () => {
    const newSystem: UnitSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    const converted: Record<string, string> = {};
    const numericKeys = ['chest', 'waist', 'hips', 'inseam', 'height', 'weight'];
    for (const [key, value] of Object.entries(measurements)) {
      const trimmed = value.trim();
      if (!trimmed) { converted[key] = value; continue; }
      if (numericKeys.includes(key)) {
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          converted[key] = String(convertMeasurement(num, key, unitSystem, newSystem));
          continue;
        }
      }
      converted[key] = value;
    }
    setMeasurements(converted);
    setUnitSystem(newSystem);
    localStorage.setItem('wardrowbe_unit_system', newSystem);
  };

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
    setMeasurementsDirty(true);
  };

  const handleSaveMeasurements = async () => {
    const parsed: Record<string, number | string> = {};
    const numericKeys = ['chest', 'waist', 'hips', 'inseam', 'height', 'weight'];
    for (const [key, value] of Object.entries(measurements)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (numericKeys.includes(key)) {
        const num = parseFloat(trimmed);
        if (isNaN(num) || num <= 0) {
          toast.error(`${key.charAt(0).toUpperCase() + key.slice(1)}必须是正数`);
          return;
        }
        parsed[key] = convertMeasurement(num, key, unitSystem, 'metric');
      } else {
        parsed[key] = trimmed;
      }
    }
    try {
      await updateUserProfile.mutateAsync({
        body_measurements: Object.keys(parsed).length > 0 ? parsed : null,
      });
      setMeasurementsDirty(false);
      toast.success('身体数据已保存');
    } catch (e) {
      toast.error(getErrorMessage(e, '保存身体数据失败'));
    }
  };

  const handleTestEndpoint = async (index: number, url: string) => {
    setEndpointTests((prev) => ({ ...prev, [index]: { status: 'testing' } }));
    try {
      const result = await testEndpoint.mutateAsync(url);
      setEndpointTests((prev) => ({
        ...prev,
        [index]: {
          status: result.status,
          models: result.available_models,
          visionModels: result.vision_models,
          textModels: result.text_models,
          error: result.error,
        },
      }));
    } catch (error) {
      setEndpointTests((prev) => ({
        ...prev,
        [index]: { status: 'error', error: '测试端点失败' },
      }));
    }
  };

  useEffect(() => {
    if (preferences) {
      setFormData(preferences);
      setHasChanges(false);
    }
  }, [preferences]);

  const updateField = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'color_favorites' && Array.isArray(value)) {
        next.color_avoid = (prev.color_avoid || []).filter(
          (c) => !(value as string[]).includes(c)
        );
      } else if (key === 'color_avoid' && Array.isArray(value)) {
        next.color_favorites = (prev.color_favorites || []).filter(
          (c) => !(value as string[]).includes(c)
        );
      }
      return next;
    });
    setHasChanges(true);
  };

  const updateStyleProfile = (key: keyof StyleProfile, value: number) => {
    setFormData((prev) => ({
      ...prev,
      style_profile: {
        ...(prev.style_profile || {
          casual: 50,
          formal: 50,
          sporty: 50,
          minimalist: 50,
          bold: 50,
        }),
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updatePreferences.mutateAsync(formData);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const handleReset = async () => {
    if (confirm('确定要将所有偏好重置为默认值吗？')) {
      try {
        await resetPreferences.mutateAsync();
      } catch (error) {
        console.error('Failed to reset preferences:', error);
      }
    }
  };

  if (isLoading || isLoadingProfile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">设置</h1>
          <p className="text-sm text-muted-foreground">
            管理您的偏好和账户设置
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetPreferences.isPending}>
            <RotateCcw className="mr-2 h-4 w-4" />
            重置
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || updatePreferences.isPending}>
            {updatePreferences.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle>账户</CardTitle>
            <CardDescription>您的个人资料信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>名称</Label>
                <Input value={userProfile?.display_name || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>邮箱</Label>
                <Input value={userProfile?.email || ''} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              位置
            </CardTitle>
            <CardDescription>
              设置您的位置以获取基于天气的穿搭推荐
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>城市/位置名称（可选）</Label>
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="例如，北京市，中国"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>纬度</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={locationLat}
                  onChange={(e) => setLocationLat(e.target.value)}
                  placeholder="例如，39.9042"
                />
              </div>
              <div className="space-y-2">
                <Label>经度</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={locationLon}
                  onChange={(e) => setLocationLon(e.target.value)}
                  placeholder="例如，116.4074"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>时区</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="选择时区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">美国东部时间</SelectItem>
                  <SelectItem value="America/Chicago">美国中部时间</SelectItem>
                  <SelectItem value="America/Denver">美国山地时间</SelectItem>
                  <SelectItem value="America/Los_Angeles">美国太平洋时间</SelectItem>
                  <SelectItem value="Europe/London">伦敦（英国）</SelectItem>
                  <SelectItem value="Europe/Paris">巴黎（欧洲中部）</SelectItem>
                  <SelectItem value="Europe/Berlin">柏林（欧洲中部）</SelectItem>
                  <SelectItem value="Asia/Tokyo">东京（日本）</SelectItem>
                  <SelectItem value="Asia/Shanghai">上海（中国）</SelectItem>
                  <SelectItem value="Asia/Kolkata">印度（IST）</SelectItem>
                  <SelectItem value="Asia/Kathmandu">尼泊尔（NPT）</SelectItem>
                  <SelectItem value="Asia/Dubai">迪拜（阿联酋）</SelectItem>
                  <SelectItem value="Australia/Sydney">悉尼（澳大利亚）</SelectItem>
                  <SelectItem value="Pacific/Auckland">奥克兰（新西兰）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 mr-2" />
                )}
                使用我的位置
              </Button>
              <Button
                onClick={handleSaveLocation}
                disabled={!hasLocationChanges || updateUserProfile.isPending}
              >
                {updateUserProfile.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                保存位置
              </Button>
            </div>
            {!locationLat && !locationLon && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                位置信息是基于天气的穿搭推荐所必需的。
              </p>
            )}
          </CardContent>
        </Card>

        {/* Body Measurements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              身体数据
            </CardTitle>
            <CardDescription>帮助AI推荐更合身的穿搭</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <Label>单位系统</Label>
              <Button variant="outline" size="sm" onClick={handleToggleUnits}>
                {unitSystem === 'metric' ? '公制 (cm/kg)' : '英制 (in/lbs)'}
              </Button>
            </div>

            <div>
              <Label className="text-muted-foreground mb-3 block">身体</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {BODY_MEASUREMENT_FIELDS.map((field) => {
                  const unit = unitSystem === 'metric' ? field.unitMetric : field.unitImperial;
                  const placeholder = unitSystem === 'metric' ? field.placeholderMetric : field.placeholderImperial;
                  return (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-sm capitalize">{field.key}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={measurements[field.key] ?? ''}
                          onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                          placeholder={placeholder}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground min-w-[2rem] text-center">{unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground mb-3 block">尺码</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {SIZE_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-sm">{field.label}</Label>
                    <Input
                      value={measurements[field.key] ?? ''}
                      onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>

            {measurementsDirty && (
              <Button
                onClick={handleSaveMeasurements}
                disabled={updateUserProfile.isPending}
                size="sm"
              >
                {updateUserProfile.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />保存身体数据</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Color Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>颜色偏好</CardTitle>
            <CardDescription>
              选择您喜欢的颜色和推荐中要避免的颜色
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ColorPicker
              label="喜欢的颜色"
              selected={formData.color_favorites || []}
              onChange={(colors) => updateField('color_favorites', colors)}
            />
            <ColorPicker
              label="要避免的颜色"
              selected={formData.color_avoid || []}
              onChange={(colors) => updateField('color_avoid', colors)}
            />
          </CardContent>
        </Card>

        {/* Style Profile */}
        <Card>
          <CardHeader>
            <CardTitle>风格档案</CardTitle>
            <CardDescription>
              调整您在穿搭推荐中对每种风格的偏好程度
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <StyleSlider
              label="休闲"
              value={formData.style_profile?.casual ?? 50}
              onChange={(v) => updateStyleProfile('casual', v)}
            />
            <StyleSlider
              label="正式"
              value={formData.style_profile?.formal ?? 50}
              onChange={(v) => updateStyleProfile('formal', v)}
            />
            <StyleSlider
              label="运动"
              value={formData.style_profile?.sporty ?? 50}
              onChange={(v) => updateStyleProfile('sporty', v)}
            />
            <StyleSlider
              label="简约"
              value={formData.style_profile?.minimalist ?? 50}
              onChange={(v) => updateStyleProfile('minimalist', v)}
            />
            <StyleSlider
              label="大胆"
              value={formData.style_profile?.bold ?? 50}
              onChange={(v) => updateStyleProfile('bold', v)}
            />
          </CardContent>
        </Card>

        {/* Temperature & Comfort */}
        <Card>
          <CardHeader>
            <CardTitle>温度与舒适度</CardTitle>
            <CardDescription>
              调整推荐如何适应天气
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>温度单位</Label>
                <Select
                  value={formData.temperature_unit || 'celsius'}
                  onValueChange={(v) =>
                    updateField('temperature_unit', v as 'celsius' | 'fahrenheit')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celsius">摄氏度 (°C)</SelectItem>
                    <SelectItem value="fahrenheit">华氏度 (°F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>温度敏感度</Label>
                <Select
                  value={formData.temperature_sensitivity || 'normal'}
                  onValueChange={(v) =>
                    updateField('temperature_sensitivity', v as 'low' | 'normal' | 'high')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">怕热</SelectItem>
                    <SelectItem value="normal">适中</SelectItem>
                    <SelectItem value="high">怕冷</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>层次偏好</Label>
                <Select
                  value={formData.layering_preference || 'moderate'}
                  onValueChange={(v) =>
                    updateField('layering_preference', v as 'minimal' | 'moderate' | 'heavy')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">少量层次</SelectItem>
                    <SelectItem value="moderate">适量层次</SelectItem>
                    <SelectItem value="heavy">大量层次</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(() => {
                const unit = formData.temperature_unit || 'celsius';
                const isFahrenheit = unit === 'fahrenheit';
                const coldC = formData.cold_threshold ?? 10;
                const hotC = formData.hot_threshold ?? 25;
                return (
                  <>
                    <div className="space-y-2">
                      <Label>寒冷阈值 ({isFahrenheit ? '°F' : '°C'})</Label>
                      <Input
                        type="number"
                        value={isFahrenheit ? Math.round(toF(coldC)) : coldC}
                        onChange={(e) => {
                          const raw = e.target.value === '' ? (isFahrenheit ? 50 : 10) : parseInt(e.target.value);
                          updateField('cold_threshold', isFahrenheit ? Math.round(toCelsius(raw)) : raw);
                        }}
                        min={isFahrenheit ? -4 : -20}
                        max={isFahrenheit ? 86 : 30}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>炎热阈值 ({isFahrenheit ? '°F' : '°C'})</Label>
                      <Input
                        type="number"
                        value={isFahrenheit ? Math.round(toF(hotC)) : hotC}
                        onChange={(e) => {
                          const raw = e.target.value === '' ? (isFahrenheit ? 77 : 25) : parseInt(e.target.value);
                          updateField('hot_threshold', isFahrenheit ? Math.round(toCelsius(raw)) : raw);
                        }}
                        min={isFahrenheit ? 50 : 10}
                        max={isFahrenheit ? 113 : 45}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        {/* Recommendation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>推荐设置</CardTitle>
            <CardDescription>
              自定义穿搭推荐的生成方式
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>默认场合</Label>
                <Select
                  value={formData.default_occasion || 'casual'}
                  onValueChange={(v) => updateField('default_occasion', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCASIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>多样性级别</Label>
                <Select
                  value={formData.variety_level || 'moderate'}
                  onValueChange={(v) =>
                    updateField('variety_level', v as 'low' | 'moderate' | 'high')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低（坚持偏好）</SelectItem>
                    <SelectItem value="moderate">适中</SelectItem>
                    <SelectItem value="high">高（尝试新组合）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>避免重复单品的间隔（天）</Label>
                <Input
                  type="number"
                  value={formData.avoid_repeat_days ?? 7}
                  onChange={(e) => updateField('avoid_repeat_days', e.target.value === '' ? 7 : parseInt(e.target.value))}
                  min={0}
                  max={30}
                />
              </div>
              <div className="space-y-2">
                <Label>优先使用使用较少的单品</Label>
                <Select
                  value={formData.prefer_underused_items ? 'yes' : 'no'}
                  onValueChange={(v) => updateField('prefer_underused_items', v === 'yes')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">是</SelectItem>
                    <SelectItem value="no">否</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              AI端点
            </CardTitle>
            <CardDescription>
              配置用于图像分析的AI端点。端点按从上到下的顺序依次尝试。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(formData.ai_endpoints || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                未配置自定义端点。使用默认服务器设置。
              </p>
            ) : (
              <div className="space-y-3">
                {(formData.ai_endpoints || []).map((endpoint, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 space-y-3 ${
                      !endpoint.enabled ? 'opacity-60 bg-muted/50' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex flex-col shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              disabled={index === 0}
                              onClick={() => {
                                const updated = [...(formData.ai_endpoints || [])];
                                [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
                                updateField('ai_endpoints', updated);
                              }}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              disabled={index === (formData.ai_endpoints || []).length - 1}
                              onClick={() => {
                                const updated = [...(formData.ai_endpoints || [])];
                                [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                                updateField('ai_endpoints', updated);
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-medium text-sm truncate">
                            {endpoint.name || `端点 ${index + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={endpoint.enabled}
                            onCheckedChange={(checked) => {
                              const updated = [...(formData.ai_endpoints || [])];
                              updated[index] = { ...updated[index], enabled: checked };
                              updateField('ai_endpoints', updated);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              const updated = (formData.ai_endpoints || []).filter((_, i) => i !== index);
                              updateField('ai_endpoints', updated);
                              setEndpointTests((prev) => {
                                const newTests = { ...prev };
                                delete newTests[index];
                                return newTests;
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Status badges and test button */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={endpoint.enabled ? 'default' : 'secondary'} className="text-xs">
                          {endpoint.enabled ? '已启用' : '已禁用'}
                        </Badge>
                        {endpointTests[index]?.status === 'connected' && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            已连接
                          </Badge>
                        )}
                        {endpointTests[index]?.status === 'error' && (
                          <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                            错误
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs ml-auto"
                          onClick={() => handleTestEndpoint(index, endpoint.url)}
                          disabled={endpointTests[index]?.status === 'testing' || !endpoint.url}
                        >
                          {endpointTests[index]?.status === 'testing' ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          测试连接
                        </Button>
                      </div>
                    </div>
                    {/* Test Results */}
                    {endpointTests[index]?.status === 'connected' && endpointTests[index]?.models && (
                      <div className="text-xs space-y-1 p-2 bg-green-50 dark:bg-green-950 rounded overflow-hidden">
                        <p className="font-medium text-green-700 dark:text-green-300">
                          {endpointTests[index].models?.length}个可用模型
                        </p>
                        {endpointTests[index].visionModels && endpointTests[index].visionModels!.length > 0 && (
                          <p className="text-green-600 dark:text-green-400 truncate" title={endpointTests[index].visionModels?.join(', ')}>
                            视觉: {endpointTests[index].visionModels?.slice(0, 3).join(', ')}
                            {(endpointTests[index].visionModels?.length || 0) > 3 && '...'}
                          </p>
                        )}
                        {endpointTests[index].textModels && endpointTests[index].textModels!.length > 0 && (
                          <p className="text-green-600 dark:text-green-400 truncate" title={endpointTests[index].textModels?.join(', ')}>
                            文本: {endpointTests[index].textModels?.slice(0, 3).join(', ')}
                            {(endpointTests[index].textModels?.length || 0) > 3 && '...'}
                          </p>
                        )}
                      </div>
                    )}
                    {endpointTests[index]?.status === 'error' && (
                      <div className="text-xs p-2 bg-red-50 dark:bg-red-950 rounded text-red-600 dark:text-red-400 break-words">
                        {endpointTests[index].error}
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">名称</Label>
                        <Input
                          value={endpoint.name}
                          onChange={(e) => {
                            const updated = [...(formData.ai_endpoints || [])];
                            updated[index] = { ...updated[index], name: e.target.value };
                            updateField('ai_endpoints', updated);
                          }}
                          placeholder="例如，本地 Ollama"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">URL</Label>
                        <Input
                          value={endpoint.url}
                          onChange={(e) => {
                            const updated = [...(formData.ai_endpoints || [])];
                            updated[index] = { ...updated[index], url: e.target.value };
                            updateField('ai_endpoints', updated);
                          }}
                          placeholder="http://localhost:11434/v1"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">视觉模型</Label>
                        <Input
                          value={endpoint.vision_model}
                          onChange={(e) => {
                            const updated = [...(formData.ai_endpoints || [])];
                            updated[index] = { ...updated[index], vision_model: e.target.value };
                            updateField('ai_endpoints', updated);
                          }}
                          placeholder="moondream"
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">文本模型</Label>
                        <Input
                          value={endpoint.text_model}
                          onChange={(e) => {
                            const updated = [...(formData.ai_endpoints || [])];
                            updated[index] = { ...updated[index], text_model: e.target.value };
                            updateField('ai_endpoints', updated);
                          }}
                          placeholder="phi3:mini"
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const newEndpoint: AIEndpoint = {
                    name: `端点 ${(formData.ai_endpoints || []).length + 1}`,
                    url: 'http://localhost:11434/v1',
                    vision_model: 'moondream',
                    text_model: 'phi3:mini',
                    enabled: true,
                  };
                  updateField('ai_endpoints', [...(formData.ai_endpoints || []), newEndpoint]);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加端点
              </Button>
              {hasChanges && (
                <Button onClick={handleSave} disabled={updatePreferences.isPending}>
                  {updatePreferences.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  保存
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
