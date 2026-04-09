-- Import colegios 2025 en partes (SQL Editor friendly)
-- Parte 31 de 31 | filas 12001-12038
begin;
insert into public.colegios (rbd, nombre, region, comuna, tipo)
values
('42337','ESCUELA AULA HOSPITALARIA DR. AUGUSTO ESSMANN','Magallanes','NATALES','Part. Subvencionado'),
('42339','CEIA INAPEWMA PUERTO MONTT','Los Lagos','PUERTO MONTT','Part. Subvencionado'),
('42340','SALA CUNA Y JARDIN INFANTIL ILLAPITAS','Metropolitana','PEÑALOLÉN','Part. Pagado'),
('42342','SALA CUNA Y JARDIN INFANTIL  PIMENTONES','Metropolitana','ÑUÑOA','Part. Pagado'),
('42343','JARDÍN INFANTIL PAPALOTE','Metropolitana','LO BARNECHEA','Part. Pagado'),
('42345','AULA HOSPITALARIA HOSPITAL RENGO','O''Higgins','RENGO','Part. Subvencionado'),
('42346','SALA CUNA Y JARDIN INFANTIL LUZ DE ANAKENA','Metropolitana','PUENTE ALTO','Part. Pagado'),
('42347','SALA CUNA Y JARDIN INFANTIL VUELTA CANELA','Metropolitana','LA FLORIDA','Part. Pagado'),
('42348','JARDIN INFANTIL LITTLE CHAMPIONS PRESCHOOL','Metropolitana','LO BARNECHEA','Part. Pagado'),
('42349','CEIA NACIONES UNIDAS','Los Lagos','QUELLÓN','Part. Subvencionado'),
('42350','ESCUELA HOSPITALARIA PUKARA','Coquimbo','LOS VILOS','Part. Subvencionado'),
('42351','ESCUELA HOSPITALARIA ANTAKARI','Coquimbo','ANDACOLLO','Part. Subvencionado'),
('42352','ESCUELA HOSPITALARIA  CRUZ DEL SUR','Coquimbo','COMBARBALÁ','Part. Subvencionado'),
('42354','ESCUELA ESPECIAL DE LENGUAJE TIEMPO DE CRECER VILLARRICA','La Araucanía','VILLARRICA','Part. Subvencionado'),
('42355','JARDÍN INFANTIL LUZ DE LOICA','Coquimbo','LA SERENA','Part. Pagado'),
('42356','CENTRO DE EDUCACIÓN INTEGRADA DE ADULTOS INAPEWMA','Biobío','CORONEL','Part. Subvencionado'),
('42357','SALA CUNA AMPALÚ','La Araucanía','TEMUCO','Part. Pagado'),
('42359','SALA CUNA Y JARDIN INFANTIL GERONIMO','Metropolitana','LAS CONDES','Part. Pagado'),
('42361','JARDIN INFANTIL NIDO','Metropolitana','VITACURA','Part. Pagado'),
('42362','SEMILLAS DE AMOR','La Araucanía','CUNCO','Part. Pagado'),
('42364','COLEGIO MANANTIALES DEL VALLE','Coquimbo','LA SERENA','Part. Subvencionado'),
('42366','JARDIN INFANTIL Y SALA CUNA DE LA CONTRALORIA GENERAL DE LA REPUBLICA','Metropolitana','SANTIAGO','Part. Pagado'),
('42368','SALA CUNA Y JARDIN INFANTIL GIRASOL TALAGANTE','Metropolitana','TALAGANTE','Part. Pagado'),
('42369','SALA CUNA Y JARDÍN INFANTIL HEIDI','Metropolitana','ESTACIÓN CENTRAL','Part. Pagado'),
('42373','SALA CUNA MI SOL','Aysén','COYHAIQUE','Part. Pagado'),
('42374','JARDIN INFANTIL RUKANTU','Metropolitana','SAN MIGUEL','Part. Pagado'),
('42375','ESCUELA ESPECIAL MI MUNDO EN MOVIMIENTO','Coquimbo','LA SERENA','Part. Subvencionado'),
('42377','LICEO CRISTIANO QUIÑENAHUIN','La Araucanía','CURARREHUE','Part. Subvencionado'),
('42383','CASA NIDO','Maule','CURICÓ','Part. Pagado'),
('42386','ESCUELA HOSPITALARIA SAN JUAN DE DIOS DE LOS ANDES','Valparaíso','LOS ANDES','Part. Subvencionado'),
('42387','JARDÍN INFANTIL MI ANGELITO MIGUEL','Metropolitana','SAN BERNARDO','Part. Pagado'),
('42390','SALA CUNA Y JARDIN INFANTIL THE MEADOWS','Metropolitana','VITACURA','Part. Pagado'),
('42391','ESCUELA BASICA COLEGIO PAKRITI','Metropolitana','CALERA DE TANGO','Part. Pagado'),
('42392','SALA CUNA Y JARDIN INFANTIL COLIBRI','Coquimbo','LA SERENA','Part. Pagado'),
('42393','SALA CUNA MANITOS DE COLORES','Los Lagos','PURRANQUE','Part. Pagado'),
('42395','ESCUELA BASICA COLEGIO PIONEROS','Metropolitana','COLINA','Part. Pagado'),
('42396','JARDIN INFANTIL MARIA VICTORIA PERALTA','Metropolitana','SANTIAGO','Part. Pagado'),
('42397','SALA CUNA LOBITOS CHILOTES HOSPITAL QUELLON','Los Lagos','QUELLÓN','Part. Pagado')
on conflict (rbd) do update set
  nombre = excluded.nombre,
  region = excluded.region,
  comuna = excluded.comuna,
  tipo = excluded.tipo;
commit;
