-- Adicionar imagem de entrega aos cards
ALTER TABLE backlog_tasks ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Adicionar updated_at nos comentários para saber se foi editado
ALTER TABLE backlog_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Adicionar status planejado que falta na constraint original
ALTER TABLE backlog_tasks DROP CONSTRAINT IF EXISTS backlog_tasks_status_check;
ALTER TABLE backlog_tasks ADD CONSTRAINT backlog_tasks_status_check
  CHECK (status IN ('backlog', 'planejado', 'fazendo', 'review', 'done'));

-- Prioridade (0 = mais urgente, 5 = menos urgente)
ALTER TABLE backlog_tasks ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 5
  CHECK (priority >= 0 AND priority <= 5);

-- Storage bucket para imagens do backlog
INSERT INTO storage.buckets (id, name, public) VALUES ('backlog-images', 'backlog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: qualquer autenticado pode fazer upload
CREATE POLICY "backlog_images_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backlog-images');

-- Policy: leitura pública
CREATE POLICY "backlog_images_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'backlog-images');

-- Policy: delete pelo autor (ou qualquer autenticado por simplicidade)
CREATE POLICY "backlog_images_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'backlog-images');
