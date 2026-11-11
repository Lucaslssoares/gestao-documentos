-- Cores das pastas raiz na nova paleta da interface (verde e laranja da Belém Bioenergia
-- mais tons de apoio para diferenciar as áreas). Só troca a cor que ainda é a original
-- de 20261005120400_dados_iniciais.sql: uma cor escolhida depois pelo administrador fica.
update public.categorias c
set cor = n.cor
from (values
  ('Jurídico',       '#8C491A', '#4E7A1C'),
  ('Financeiro',     '#3D472B', '#7AA52A'),
  ('Fiscal',         '#C67139', '#E14E0D'),
  ('Suprimentos',    '#645C50', '#C98A12'),
  ('RH',             '#8C491A', '#2F7FA8'),
  ('Administrativo', '#3D472B', '#5B6B4E'),
  ('Operacional',    '#C67139', '#7B5EA7')
) as n(nome, cor_antiga, cor)
where c.parent_id is null
  and c.nome = n.nome
  and upper(c.cor) = n.cor_antiga;
