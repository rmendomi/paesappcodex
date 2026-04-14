-- ═══════════════════════════════════════════════════════════════════
-- PAES App — Seed de Universidades y Carreras
-- Fuente: DEMRE proceso admisión 2024 / sitios oficiales CRUCH
-- Última actualización: 2024-11-01
-- IMPORTANTE: Ejecutar DESPUÉS de supabase_planner_mejoras.sql
-- ═══════════════════════════════════════════════════════════════════

-- ── Limpiar datos previos (idempotente) ────────────────────────────
TRUNCATE carreras, universidades RESTART IDENTITY CASCADE;

-- ── Universidades ──────────────────────────────────────────────────
INSERT INTO universidades (id, nombre, abbr, tipo, ciudad, acreditacion, descripcion, color, logo, fuente, anio)
VALUES
  ('uchile',    'Universidad de Chile',                         'UCH',   'Estatal',       'Santiago',    7, 'La principal universidad pública del país, fundada en 1842. Referente en investigación, postgrado y extensión a nivel latinoamericano.',                                                                 '#003580', '🔵', 'DEMRE/CRUCH 2024', 2024),
  ('usach',     'U. de Santiago de Chile',                      'USACH', 'Estatal',       'Santiago',    7, 'Universidad estatal con fuerte vocación tecnológica e inclusiva. Líder en ingeniería, ciencias aplicadas y programas de movilidad social.',                                                            '#c41230', '🔴', 'DEMRE/CRUCH 2024', 2024),
  ('uv',        'Universidad de Valparaíso',                    'UV',    'Estatal',       'Valparaíso',  5, 'Universidad estatal de la región de Valparaíso. Reconocida por sus carreras del área salud, derecho y ciencias sociales.',                                                                             '#006600', '🟢', 'DEMRE/CRUCH 2024', 2024),
  ('ufro',      'U. de La Frontera',                            'UFRO',  'Estatal',       'Temuco',      5, 'Universidad estatal de La Araucanía con vocación regional. Reconocida por medicina, ingeniería y su compromiso con el territorio mapuche.',                                                            '#8b0000', '🦁', 'DEMRE/CRUCH 2024', 2024),
  ('ubb',       'Universidad del Bío-Bío',                      'UBB',   'Estatal',       'Concepción',  5, 'Universidad estatal con sedes en Concepción y Chillán. Especializada en ingeniería, arquitectura y ciencias sociales con enfoque regional.',                                                           '#1a5276', '🔷', 'DEMRE/CRUCH 2024', 2024),
  ('utalca',    'Universidad de Talca',                         'UTalca','Estatal',       'Talca',       5, 'Universidad estatal del Maule con campus en Talca, Curicó y Linares. Destaca en agronomía, ingeniería, ciencias de la salud y derecho.',                                                               '#1e3a5f', '🍇', 'DEMRE/CRUCH 2024', 2024),
  ('puc',       'Pontificia U. Católica de Chile',              'PUC',   'Privada CRUCH', 'Santiago',    7, 'Una de las universidades más selectivas del país. Destacada en investigación, innovación y formación profesional. Sedes en Santiago y Villarrica.',                                                    '#1a3a5c', '⭐', 'DEMRE/CRUCH 2024', 2024),
  ('usm',       'U. Técnica Federico Santa María',              'USM',   'Privada CRUCH', 'Valparaíso',  6, 'Universidad técnica de excelencia con campus en Valparaíso, Santiago y Viña del Mar. Líder indiscutida en ingeniería y ciencias aplicadas de Chile.',                                                  '#003087', '⚙️', 'DEMRE/CRUCH 2024', 2024),
  ('pucv',      'Pontificia U. Católica de Valparaíso',         'PUCV',  'Privada CRUCH', 'Valparaíso',  6, 'Universidad católica regional con sólido arraigo en Valparaíso. Amplia oferta en ingeniería, ciencias del mar, derecho y educación.',                                                                 '#1a3060', '✝️', 'DEMRE/CRUCH 2024', 2024),
  ('udec',      'Universidad de Concepción',                    'UdeC',  'Privada CRUCH', 'Concepción',  6, 'Principal universidad del sur de Chile. Campus universitario referente, amplia oferta en ciencias, ingeniería y salud.',                                                                               '#003865', '💙', 'DEMRE/CRUCH 2024', 2024),
  ('uach',      'Universidad Austral de Chile',                 'UACh',  'Privada CRUCH', 'Valdivia',    5, 'Universidad del sur de Chile destacada en ciencias naturales, medicina veterinaria y ciencias de la salud. Sede en Puerto Montt.',                                                                     '#0a472e', '🌿', 'DEMRE/CRUCH 2024', 2024),
  ('unab',      'U. Andrés Bello',                              'UNAB',  'Privada',       'Santiago',    6, 'Universidad privada con sedes en Santiago, Viña del Mar y Concepción. Amplia oferta en salud, derecho, ingeniería y artes.',                                                                           '#c41230', '🎓', 'DEMRE/CRUCH 2024', 2024),
  ('udp',       'U. Diego Portales',                            'UDP',   'Privada',       'Santiago',    5, 'Universidad privada santiaguina reconocida por derecho, periodismo, arquitectura e ingeniería. Sello en pensamiento crítico y vinculación social.',                                                    '#e8630a', '🌐', 'DEMRE/CRUCH 2024', 2024),
  ('uautonoma', 'U. Autónoma de Chile',                         'UA',    'Privada',       'Santiago',    4, 'Universidad privada con sedes en Santiago, Temuco y Talca. Amplia oferta en salud, educación y ciencias sociales con aranceles accesibles.',                                                           '#e8000d', '🔴', 'DEMRE/CRUCH 2024', 2024);

-- ── Carreras ───────────────────────────────────────────────────────
-- Universidad de Chile
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('uchile', 'Medicina',               '{"nem":0.1,"lectora":0.15,"m1":0.2,"ciencias":0.55}', 865,  85),
  ('uchile', 'Odontología',            '{"nem":0.1,"lectora":0.15,"m1":0.2,"ciencias":0.55}', 785,  75),
  ('uchile', 'Ingeniería Civil',       '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',         790, 240),
  ('uchile', 'Ingeniería Comercial',   '{"nem":0.1,"lectora":0.2,"m1":0.3,"m2":0.4}',         715, 160),
  ('uchile', 'Derecho',                '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',   755, 130),
  ('uchile', 'Psicología',             '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',   705, 100),
  ('uchile', 'Economía',               '{"nem":0.1,"lectora":0.15,"m1":0.25,"m2":0.5}',       730, 120),
  ('uchile', 'Sociología',             '{"nem":0.2,"lectora":0.4,"m1":0.2,"historia":0.2}',   620,  70);

-- U. de Santiago de Chile
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('usach', 'Medicina',                     '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  830,  45),
  ('usach', 'Ingeniería Civil Industrial',  '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',         730, 140),
  ('usach', 'Ingeniería en Informática',    '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',         700, 170),
  ('usach', 'Química y Farmacia',           '{"nem":0.2,"lectora":0.1,"m1":0.2,"ciencias":0.5}',   680,  60),
  ('usach', 'Administración Pública',       '{"nem":0.2,"lectora":0.3,"m1":0.3,"historia":0.2}',   600, 150),
  ('usach', 'Historia',                     '{"nem":0.2,"lectora":0.4,"m1":0.1,"historia":0.3}',   580,  50),
  ('usach', 'Trabajo Social',               '{"nem":0.2,"lectora":0.4,"m1":0.2,"historia":0.2}',   550,  80);

-- Universidad de Valparaíso
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('uv', 'Medicina',       '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  800, 50),
  ('uv', 'Derecho',        '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  660, 100),
  ('uv', 'Psicología',     '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',  630,  70),
  ('uv', 'Obstetricia',    '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}',  690,  45),
  ('uv', 'Kinesiología',   '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}',  650,  60),
  ('uv', 'Trabajo Social', '{"nem":0.2,"lectora":0.4,"m1":0.2,"historia":0.2}',  550,  80);

-- U. de La Frontera
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('ufro', 'Medicina',         '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}', 790, 45),
  ('ufro', 'Odontología',      '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}', 710, 35),
  ('ufro', 'Ingeniería Civil', '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',       670, 80),
  ('ufro', 'Psicología',       '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}', 590, 60),
  ('ufro', 'Pedagogía Básica', '{"nem":0.3,"lectora":0.3,"m1":0.2,"historia":0.2}', 540, 50);

-- Universidad del Bío-Bío
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('ubb', 'Ingeniería Civil Industrial', '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        650, 100),
  ('ubb', 'Arquitectura',                '{"nem":0.2,"lectora":0.2,"m1":0.3,"m2":0.3}',         600,  60),
  ('ubb', 'Ingeniería Informática',      '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',         620,  80),
  ('ubb', 'Pedagogía en Matemática',     '{"nem":0.2,"lectora":0.2,"m1":0.2,"m2":0.4}',         540,  40),
  ('ubb', 'Trabajo Social',              '{"nem":0.2,"lectora":0.4,"m1":0.2,"historia":0.2}',   500,  80);

-- Universidad de Talca
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('utalca', 'Ingeniería Civil',     '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        640, 80),
  ('utalca', 'Medicina Veterinaria', '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  620, 40),
  ('utalca', 'Derecho',              '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  610, 80),
  ('utalca', 'Psicología',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',  610, 60),
  ('utalca', 'Kinesiología',         '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}',  590, 50),
  ('utalca', 'Agronomía',            '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}',  560, 70);

-- PUC
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('puc', 'Medicina',             '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  875,  70),
  ('puc', 'Odontología',          '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  790,  55),
  ('puc', 'Ingeniería Civil',     '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        805, 220),
  ('puc', 'Ingeniería Comercial', '{"nem":0.1,"lectora":0.2,"m1":0.3,"m2":0.4}',        735, 180),
  ('puc', 'Derecho',              '{"nem":0.2,"lectora":0.4,"m1":0.1,"historia":0.3}',  760, 140),
  ('puc', 'Psicología',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',  730,  80),
  ('puc', 'Arquitectura',         '{"nem":0.2,"lectora":0.2,"m1":0.3,"m2":0.3}',        685,  80),
  ('puc', 'Enfermería',           '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}',  655,  90);

-- USM
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('usm', 'Ingeniería Civil Industrial',  '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}', 745, 120),
  ('usm', 'Ingeniería Civil Electrónica', '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}', 730,  90),
  ('usm', 'Ingeniería en Informática',    '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}', 720, 100),
  ('usm', 'Ingeniería Comercial',         '{"nem":0.1,"lectora":0.2,"m1":0.3,"m2":0.4}', 690, 110),
  ('usm', 'Arquitectura',                 '{"nem":0.2,"lectora":0.2,"m1":0.3,"m2":0.3}', 630,  60);

-- PUCV
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('pucv', 'Ingeniería Civil',     '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        720, 100),
  ('pucv', 'Ingeniería Comercial', '{"nem":0.1,"lectora":0.2,"m1":0.3,"m2":0.4}',        640, 120),
  ('pucv', 'Derecho',              '{"nem":0.2,"lectora":0.4,"m1":0.1,"historia":0.3}',  660, 100),
  ('pucv', 'Psicología',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',  640,  80),
  ('pucv', 'Arquitectura',         '{"nem":0.2,"lectora":0.2,"m1":0.3,"m2":0.3}',        650,  60),
  ('pucv', 'Periodismo',           '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  580,  60);

-- U. de Concepción
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('udec', 'Medicina',                    '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  815, 60),
  ('udec', 'Odontología',                 '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  750, 40),
  ('udec', 'Ingeniería Civil Industrial', '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        725, 130),
  ('udec', 'Ingeniería Informática',      '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        680, 80),
  ('udec', 'Derecho',                     '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  660, 80),
  ('udec', 'Pedagogía en Matemática',     '{"nem":0.2,"lectora":0.2,"m1":0.2,"m2":0.4}',        600, 40),
  ('udec', 'Periodismo',                  '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  590, 55);

-- U. Austral de Chile
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('uach', 'Medicina',                       '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}', 790, 40),
  ('uach', 'Medicina Veterinaria',           '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}', 675, 60),
  ('uach', 'Ing. Civil en Obras Civiles',    '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',       680, 70),
  ('uach', 'Ingeniería Informática',         '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',       650, 60),
  ('uach', 'Kinesiología',                   '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}', 620, 50),
  ('uach', 'Turismo y Ecoturismo',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"historia":0.2}', 500, 60);

-- U. Andrés Bello
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('unab', 'Medicina',             '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  780, 90),
  ('unab', 'Odontología',          '{"nem":0.1,"lectora":0.1,"m1":0.2,"ciencias":0.6}',  700, 80),
  ('unab', 'Ingeniería Civil',     '{"nem":0.1,"lectora":0.1,"m1":0.2,"m2":0.6}',        660, 120),
  ('unab', 'Derecho',              '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  620, 200),
  ('unab', 'Psicología',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',  580, 180),
  ('unab', 'Kinesiología',         '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}',  580, 130);

-- U. Diego Portales
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('udp', 'Derecho',              '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  610, 180),
  ('udp', 'Periodismo',           '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}',  590,  80),
  ('udp', 'Psicología',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}',  580, 120),
  ('udp', 'Arquitectura',         '{"nem":0.2,"lectora":0.2,"m1":0.3,"m2":0.3}',        550,  80),
  ('udp', 'Ingeniería Comercial', '{"nem":0.1,"lectora":0.2,"m1":0.3,"m2":0.4}',        580, 150),
  ('udp', 'Diseño',               '{"nem":0.3,"lectora":0.3,"m1":0.2,"historia":0.2}',  540,  60);

-- U. Autónoma de Chile
INSERT INTO carreras (universidad_id, nombre, ponderaciones, puntaje_corte, vacantes) VALUES
  ('uautonoma', 'Psicología',           '{"nem":0.2,"lectora":0.4,"m1":0.2,"ciencias":0.2}', 510, 180),
  ('uautonoma', 'Kinesiología',         '{"nem":0.2,"lectora":0.2,"m1":0.2,"ciencias":0.4}', 530, 120),
  ('uautonoma', 'Odontología',          '{"nem":0.1,"lectora":0.2,"m1":0.2,"ciencias":0.5}', 575,  90),
  ('uautonoma', 'Derecho',              '{"nem":0.2,"lectora":0.5,"m1":0.1,"historia":0.2}', 530, 220),
  ('uautonoma', 'Ingeniería Comercial', '{"nem":0.1,"lectora":0.2,"m1":0.3,"m2":0.4}',       490, 160),
  ('uautonoma', 'Pedagogía Básica',     '{"nem":0.3,"lectora":0.3,"m1":0.2,"historia":0.2}', 450, 120);
