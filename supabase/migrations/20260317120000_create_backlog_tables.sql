-- Tarefas do Kanban
CREATE TABLE backlog_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('feature', 'bug')),
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'fazendo', 'review', 'done')),
  assigned_to UUID REFERENCES user_profiles(id),
  definition_of_done TEXT DEFAULT '',
  due_date DATE,
  position INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentários nas tarefas
CREATE TABLE backlog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES backlog_tasks(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES user_profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_backlog_tasks_status ON backlog_tasks(status, position);
CREATE INDEX idx_backlog_comments_task ON backlog_comments(task_id, created_at);

-- RLS
ALTER TABLE backlog_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlog_comments ENABLE ROW LEVEL SECURITY;

-- Policies: todos os usuários autenticados podem ler e escrever
CREATE POLICY "backlog_tasks_all" ON backlog_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "backlog_comments_all" ON backlog_comments FOR ALL USING (true) WITH CHECK (true);

-- Coluna para vincular GitHub username aos user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github_username TEXT;
