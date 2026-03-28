'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, Users, MapPin, MoreVertical, Trash2, Copy, Pencil, LogOut, User, LogIn, Archive, RotateCcw, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Project, ProjectType, PROJECT_TYPE_LABELS } from '@/types';
import { getProjects, createProject, deleteProject, copyProject, updateProjectName, getTrashProjects, restoreProject, permanentDeleteProject } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    type: '' as ProjectType | '',
    remark: '',
  });
  
  // 重命名相关状态
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string>('');
  const [renameProjectName, setRenameProjectName] = useState('');
  
  // 回收站相关状态
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [trashProjects, setTrashProjects] = useState<Project[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      loadProjects();
    } else if (!authLoading && !user) {
      setProjectsLoading(false);
    }
  }, [user, authLoading]);

  const loadProjects = async () => {
    setProjectsLoading(true);
    const projectList = await getProjects();
    setProjects(projectList);
    setProjectsLoading(false);
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称');
      return;
    }
    
    if (!newProject.type) {
      alert('请选择项目类型');
      return;
    }

    const result = await createProject(newProject.name, newProject.type, newProject.remark);
    if (result) {
      setIsDialogOpen(false);
      setNewProject({ name: '', type: '', remark: '' });
      router.push(`/project/${result.project.id}`);
    } else {
      alert('创建项目失败，请重试');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('确定要删除这个项目吗？删除后可在回收站找回。')) {
      const success = await deleteProject(projectId);
      if (success) {
        loadProjects();
      } else {
        alert('删除项目失败，请重试');
      }
    }
  };

  // 加载回收站项目
  const loadTrashProjects = async () => {
    setTrashLoading(true);
    const projects = await getTrashProjects();
    setTrashProjects(projects);
    setTrashLoading(false);
  };

  // 打开回收站
  const handleOpenTrash = () => {
    setIsTrashDialogOpen(true);
    loadTrashProjects();
  };

  // 恢复项目
  const handleRestoreProject = async (projectId: string) => {
    const success = await restoreProject(projectId);
    if (success) {
      loadTrashProjects();
      loadProjects();
    } else {
      alert('恢复项目失败，请重试');
    }
  };

  // 永久删除项目
  const handlePermanentDelete = async (projectId: string) => {
    if (confirm('确定要永久删除这个项目吗？此操作不可恢复。')) {
      const success = await permanentDeleteProject(projectId);
      if (success) {
        loadTrashProjects();
      } else {
        alert('删除项目失败，请重试');
      }
    }
  };

  const handleCopyProject = async (projectId: string) => {
    const newProject = await copyProject(projectId);
    if (newProject) {
      loadProjects();
    } else {
      alert('复制项目失败，请重试');
    }
  };

  const handleRenameProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setRenameProjectId(projectId);
      setRenameProjectName(project.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleConfirmRename = async () => {
    if (!renameProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }
    const success = await updateProjectName(renameProjectId, renameProjectName.trim());
    if (success) {
      setIsRenameDialogOpen(false);
      loadProjects();
    } else {
      alert('重命名失败，请重试');
    }
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    setProjects([]);
  };
  
  const projectTypes: { value: ProjectType; label: string; description: string }[] = [
    { value: 'half-day', label: '半日', description: '半天活动，不含住宿' },
    { value: 'one-day', label: '一日', description: '单日活动，不含住宿' },
    { value: 'multi-day', label: '多日', description: '多日活动，含住宿安排' },
  ];

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">研学旅行成本核算</h1>
                <p className="text-sm text-gray-500">快速核算，精准报价</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                    新建项目
                  </Button>
                  
                  <Button variant="outline" size="icon" onClick={handleOpenTrash} title="回收站">
                    <Archive className="w-4 h-4" />
                  </Button>

                  {/* 新建项目对话框 */}
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>新建研学项目</DialogTitle>
                        <DialogDescription>
                          创建一个新的研学项目，开始进行成本核算
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="name">项目名称 <span className="text-red-500">*</span></Label>
                          <Input
                            id="name"
                            placeholder="例如：北京科技研学之旅"
                            value={newProject.name}
                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>项目类型 <span className="text-red-500">*</span></Label>
                          <div className="grid grid-cols-3 gap-2">
                            {projectTypes.map((type) => (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => setNewProject({ ...newProject, type: type.value })}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                  newProject.type === type.value
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="font-medium text-sm">{type.label}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="remark">项目备注</Label>
                          <Textarea
                            id="remark"
                            placeholder="记录项目的特殊说明或要求..."
                            value={newProject.remark}
                            onChange={(e) => setNewProject({ ...newProject, remark: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          取消
                        </Button>
                        <Button onClick={handleCreateProject}>创建项目</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* 重命名项目对话框 */}
                  <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>重命名项目</DialogTitle>
                        <DialogDescription>
                          为项目设置一个新名称
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="rename-name">项目名称</Label>
                          <Input
                            id="rename-name"
                            placeholder="输入新的项目名称"
                            value={renameProjectName}
                            onChange={(e) => setRenameProjectName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleConfirmRename();
                              }
                            }}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                          取消
                        </Button>
                        <Button onClick={handleConfirmRename}>确认</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* 回收站对话框 */}
                  <Dialog open={isTrashDialogOpen} onOpenChange={setIsTrashDialogOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Archive className="w-5 h-5" />
                          回收站
                        </DialogTitle>
                        <DialogDescription>
                          已删除的项目将在回收站保留，您可以恢复或永久删除
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-[400px] overflow-y-auto">
                        {trashLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : trashProjects.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>回收站是空的</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {trashProjects.map((project) => (
                              <div 
                                key={project.id} 
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                                      {PROJECT_TYPE_LABELS[project.type]}
                                    </span>
                                    <span className="font-medium">{project.name}</span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    删除于 {project.deletedAt ? new Date(project.deletedAt).toLocaleString() : '-'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleRestoreProject(project.id)}
                                    className="gap-1"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    恢复
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handlePermanentDelete(project.id)}
                                    className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash className="w-3 h-3" />
                                    永久删除
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                        <User className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-sm text-gray-600">
                        {user.email}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        退出登录
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button className="gap-2" onClick={() => setIsAuthModalOpen(true)}>
                  <LogIn className="w-4 h-4" />
                  登录 / 注册
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!user ? (
          // 未登录状态
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <User className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">欢迎使用研学旅行成本核算工具</h2>
            <p className="text-gray-500 mb-6">请登录或注册账号，开始管理您的研学项目</p>
            <Button onClick={() => setIsAuthModalOpen(true)} className="gap-2">
              <LogIn className="w-4 h-4" />
              登录 / 注册
            </Button>
          </div>
        ) : projectsLoading ? (
          // 加载中
          <div className="flex items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : projects.length === 0 ? (
          // 已登录但无项目
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
              <Calendar className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">还没有项目</h2>
            <p className="text-gray-500 mb-6">点击上方"新建项目"开始创建您的第一个研学项目</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              创建第一个项目
            </Button>
          </div>
        ) : (
          // 项目列表
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-300"
                onClick={() => handleOpenProject(project.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {PROJECT_TYPE_LABELS[project.type]}
                        </span>
                      </div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {project.remark && (
                        <CardDescription className="mt-2 line-clamp-2">
                          {project.remark}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameProject(project.id);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyProject(project.id);
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          复制项目
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除项目
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>创建于 {new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>最后更新: {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
