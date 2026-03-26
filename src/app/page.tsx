'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Calendar, Users, MapPin, MoreVertical, Trash2, Copy, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Project, ProjectType, PROJECT_TYPE_LABELS } from '@/types';
import { getProjects, createProject, deleteProject, copyProject, updateProjectName } from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    type: '' as ProjectType | '',
    remark: '',
  });
  
  // 重命名相关状态
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string>('');
  const [renameProjectName, setRenameProjectName] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    const projectList = getProjects();
    setProjects(projectList);
  };

  const handleCreateProject = () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称');
      return;
    }
    
    if (!newProject.type) {
      alert('请选择项目类型');
      return;
    }

    createProject(newProject.name, newProject.type, newProject.remark);
    setIsDialogOpen(false);
    setNewProject({ name: '', type: '', remark: '' });
    loadProjects();
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('确定要删除这个项目吗？此操作不可恢复。')) {
      deleteProject(projectId);
      loadProjects();
    }
  };

  const handleCopyProject = (projectId: string) => {
    const newProject = copyProject(projectId);
    if (newProject) {
      loadProjects();
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

  const handleConfirmRename = () => {
    if (!renameProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }
    updateProjectName(renameProjectId, renameProjectName.trim());
    setIsRenameDialogOpen(false);
    loadProjects();
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };
  
  const projectTypes: { value: ProjectType; label: string; description: string }[] = [
    { value: 'half-day', label: '半日', description: '半天活动，不含住宿' },
    { value: 'one-day', label: '一日', description: '单日活动，不含住宿' },
    { value: 'multi-day', label: '多日', description: '多日活动，含住宿安排' },
  ];

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
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  新建项目
                </Button>
              </DialogTrigger>
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {projects.length === 0 ? (
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
