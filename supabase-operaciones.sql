CREATE TABLE IF NOT EXISTS public.operaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.operaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to operaciones" 
  ON public.operaciones FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to modify operaciones"
  ON public.operaciones FOR ALL USING (auth.role() = 'authenticated');
  
INSERT INTO public.operaciones (nombre) VALUES
('Multidimensionales'), ('Red polar'), ('Frigorifico'),
('Alkosto'), ('Pepsico funza'), ('Pepsico maquila'),
('Pepsico 3pd'), ('materia prima B9'), ('Administrativo J3'),
('Administrativo B9'), ('Giron'), ('Buga'),
('Pepsico Bucaramanga'), ('Pepsico Barranquilla')
ON CONFLICT DO NOTHING;
