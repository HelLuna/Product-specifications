const pool = require('./pool').pool;

const sql_create_table_func = `/*Создание таблиц*/
CREATE TABLE IF NOT EXISTS ei (
                ei_id SERIAL NOT NULL,
                name VARCHAR(50) NOT NULL,
                short_name VARCHAR(25) NOT NULL,
                code INTEGER NOT NULL,
                CONSTRAINT ei_id PRIMARY KEY (ei_id)
);
 
 
CREATE TABLE IF NOT EXISTS product_classifier (
                class_id SERIAL NOT NULL,
                parent_class_id INTEGER,
                ei_id INTEGER NOT NULL,
                name VARCHAR(50) NOT NULL,
                CONSTRAINT prod_class_id PRIMARY KEY (class_id),
                FOREIGN KEY (ei_id) REFERENCES ei (ei_id)
                ON DELETE CASCADE ON UPDATE CASCADE
                NOT DEFERRABLE,
                FOREIGN KEY (parent_class_id) REFERENCES product_classifier (class_id)
                ON DELETE CASCADE ON UPDATE CASCADE
                NOT DEFERRABLE
);
 
 
CREATE TABLE IF NOT EXISTS product (
                prod_id VARCHAR(50) NOT NULL,
                class_id INTEGER NOT NULL,
                name VARCHAR(50) NOT NULL,
                CONSTRAINT prod_id PRIMARY KEY (prod_id),
                FOREIGN KEY (class_id) REFERENCES product_classifier (class_id)
                ON DELETE CASCADE ON UPDATE CASCADE
                NOT DEFERRABLE
);

CREATE TABLE IF NOT EXISTS product_specification (
                pos_num INTEGER NOT NULL,
                prod_id VARCHAR(50) NOT NULL,
                part_id VARCHAR(50) NOT NULL,
                quantity INTEGER NOT NULL,
                CONSTRAINT prod_spec_num PRIMARY KEY (pos_num, prod_id),
				FOREIGN KEY (prod_id) REFERENCES product (prod_id)
				ON DELETE CASCADE ON UPDATE CASCADE
				NOT DEFERRABLE,
				FOREIGN KEY (part_id) REFERENCES product (prod_id)
				ON DELETE CASCADE ON UPDATE CASCADE
				NOT DEFERRABLE
);

/*Методы*/
/*Методы класса product_classifier*/
--Создание класса
CREATE OR REPLACE FUNCTION createClass(new_name VARCHAR(50), new_ei_id INTEGER, new_parent_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF  ((SELECT COUNT(*) FROM product_classifier WHERE class_id = new_parent_id) = 1 OR
            (new_parent_id IS NULL AND (SELECT COUNT(*) FROM product_classifier) = 0)) AND
        (SELECT COUNT(*) FROM ei WHERE ei_id = new_ei_id) = 1 AND
        (SELECT COUNT(*) FROM product_classifier WHERE name = new_name) = 0
        THEN INSERT INTO product_classifier(name, ei_id, parent_class_id) VALUES (new_name, new_ei_id, new_parent_id);
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Создание корневого класса
CREATE OR REPLACE FUNCTION createRootClass(new_name TEXT, new_ei_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM ei WHERE ei_id = new_ei_id) = 1 AND
    (SELECT COUNT(*) FROM product_classifier WHERE name = new_name) = 0 AND
    ((SELECT COUNT(*) FROM product_classifier WHERE parent_class_id IS NULL) = 1 OR
     (SELECT COUNT(*) FROM product_classifier) = 0) THEN
        INSERT INTO product_classifier (name, ei_id, parent_class_id) VALUES (new_name, new_ei_id, NULL);
        UPDATE product_classifier SET parent_class_id = (SELECT class_id FROM product_classifier WHERE name = new_name)
        WHERE class_id = (SELECT class_id FROM product_classifier WHERE parent_class_id IS NULL AND name != new_name);
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Выбрать
CREATE OR REPLACE FUNCTION selectClass(target_id INTEGER) 
RETURNS TABLE (result_class_id INTEGER, 
               result_name VARCHAR(50), 
               result_ei_id INTEGER, 
               result_parent_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 1 THEN
        RETURN QUERY SELECT class_id, name, ei_id, parent_class_id FROM product_classifier WHERE class_id = target_id;
    ELSE
        RETURN QUERY SELECT 0, '0', 0, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Удаление класса
CREATE OR REPLACE FUNCTION deleteClass(target_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 
        THEN RETURN -1;
    END IF;
    IF  (SELECT COUNT(*) FROM product_classifier WHERE parent_class_id = target_id) = 0 AND
        (SELECT COUNT(*) FROM product WHERE class_id = target_id) = 0 
        THEN DELETE FROM product_classifier WHERE class_id = target_id;
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Удалить вместе с потомками 
CREATE OR REPLACE FUNCTION deleteClassAndDesc(target_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 
        THEN RETURN 0;
    END IF;
    IF  (SELECT COUNT(*) FROM product_classifier WHERE parent_class_id = target_id) = 0 AND
        (SELECT COUNT(*) FROM product WHERE class_id = target_id) = 0 
        THEN DELETE FROM product_classifier WHERE class_id = target_id;
        RETURN 1;
    ELSE
        DELETE FROM product_classifier WHERE class_id = target_id;
        DELETE FROM product WHERE class_id = target_id;
        DELETE FROM product_classifier WHERE parent_class_id = target_id;
        DELETE FROM product WHERE class_id IN (SELECT class_id FROM product_classifier WHERE parent_class_id = target_id);
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
 
--Изменить родителя
CREATE OR REPLACE FUNCTION changePcParent(new_class_id INTEGER, new_parent_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF new_parent_id = new_class_id 
        THEN RETURN 0;
    END IF;
    IF  ((SELECT COUNT(*) FROM product_classifier WHERE class_id = new_parent_id) = 1 OR
            (new_parent_id IS NULL AND (SELECT COUNT(*) FROM product_classifier) = 1)) AND
        (SELECT COUNT(*) FROM product_classifier WHERE class_id = new_class_id) = 1 
        THEN UPDATE product_classifier SET parent_class_id = new_parent_id WHERE class_id = new_class_id;
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Выбрать родителя 
CREATE OR REPLACE FUNCTION selectPcParent(target_id INTEGER) 
RETURNS TABLE (result_class_id INTEGER, 
               result_name VARCHAR(50), 
               result_ei_id INTEGER, 
               result_parent_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 1 THEN
        IF (SELECT parent_class_id IS NOT NULL FROM product_classifier WHERE class_id = target_id) = TRUE THEN
            RETURN QUERY SELECT class_id, name, ei_id, parent_class_id FROM product_classifier WHERE class_id = (SELECT parent_class_id FROM product_classifier WHERE class_id = target_id);
        ELSE
            RETURN QUERY SELECT 0, 'NULL', 0, 0;
        END IF;
    ELSE
        RETURN QUERY SELECT 0, '0', 0, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Редактировать
CREATE OR REPLACE FUNCTION changePc(target_id INTEGER, new_name VARCHAR(50), new_ei_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 THEN
        RETURN 0;
    ELSE
        UPDATE product_classifier SET name = new_name, ei_id = new_ei_id WHERE class_id = target_id;
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Найти потомков
CREATE OR REPLACE FUNCTION selectPcChildren(target_id INTEGER) 
RETURNS TABLE (result_class_id INTEGER, 
               result_name VARCHAR(50), 
               result_ei_id INTEGER, 
               result_parent_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, '0', 0, 0;
    ELSE
        RETURN QUERY WITH RECURSIVE children AS (
            SELECT class_id, name, ei_id, parent_class_id FROM product_classifier WHERE class_id = target_id
            UNION ALL
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc, children c WHERE pc.parent_class_id = c.class_id
        ) SELECT * FROM children WHERE class_id != target_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
-- Найти всех потомков, включая product
CREATE OR REPLACE FUNCTION selectPcChildrenWithProducts(target_id INTEGER) 
RETURNS TABLE (result_class_id INTEGER, 
               result_name VARCHAR(50), 
               result_ei_id INTEGER, 
               result_parent_class_id INTEGER, 
               result_prod_id VARCHAR(50),  
               result_prod_class_id INTEGER,
			   result_prod_name VARCHAR(50)) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, '0', 0, 0, '0', 0, '0';
    ELSE
        RETURN QUERY WITH RECURSIVE children AS (
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc WHERE class_id = target_id
            UNION ALL
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc, children c WHERE pc.parent_class_id = c.class_id
        ) SELECT *
			FROM children c
			LEFT JOIN product p ON c.class_id = p.class_id
			WHERE (c.class_id != target_id OR c.class_id = target_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
  
-- Найти родителей
CREATE OR REPLACE FUNCTION selectPcParents(target_id INTEGER) 
RETURNS TABLE (result_class_id INTEGER, 
               result_name VARCHAR(50), 
               result_ei_id INTEGER, 
               result_parent_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, '0', 0, 0;
    ELSE
        RETURN QUERY WITH RECURSIVE parents AS (
            SELECT class_id, name, ei_id, parent_class_id FROM product_classifier WHERE class_id = target_id
            UNION ALL
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc, parents p WHERE pc.class_id = p.parent_class_id
        ) SELECT * FROM parents WHERE class_id != target_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
-- Найти изделия этого класса
CREATE OR REPLACE FUNCTION selectClassProd(target_id INTEGER) 
RETURNS TABLE (result_prod_id VARCHAR(50), 
               result_prod_name VARCHAR(50), 
               result_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = target_id) = 0 THEN
        RETURN QUERY SELECT '0', '0', 0;
    ELSE
        RETURN QUERY WITH RECURSIVE children AS (
            SELECT class_id, name, ei_id, parent_class_id FROM product_classifier WHERE class_id = target_id
            UNION ALL
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc, children c WHERE pc.parent_class_id = c.class_id
        ) SELECT p.prod_id, p.name, c.class_id
			FROM children c
			RIGHT JOIN product p ON c.class_id = p.class_id
			WHERE (c.class_id != target_id OR c.class_id = target_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
 
/*Методы класса product*/
--Создание изделия
CREATE OR REPLACE FUNCTION createProduct(new_prod_id VARCHAR(50), new_name VARCHAR(50), new_class_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = new_class_id) = 0 
        THEN RETURN 0;
    END IF;
    INSERT INTO product (prod_id, name, class_id) VALUES (new_prod_id, new_name, new_class_id);
	RETURN 1;
END;
$$ LANGUAGE plpgsql;
  
--Удалить изделие
CREATE OR REPLACE FUNCTION deleteProduct(target_id VARCHAR(50)) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product WHERE prod_id = target_id) = 0 
        THEN RETURN 0;
    ELSE
        DELETE FROM product WHERE prod_id = target_id;
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Изменить класс изделия
CREATE OR REPLACE FUNCTION changeProductParent(target_id VARCHAR(50), new_class_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product WHERE prod_id = target_id) = 0 
        THEN RETURN 0;
    END IF;
    IF (SELECT COUNT(*) FROM product_classifier WHERE class_id = new_class_id) = 0 
        THEN RETURN -1;
    ELSE
        UPDATE product SET class_id = new_class_id WHERE prod_id = target_id;
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Найти родителей
CREATE OR REPLACE FUNCTION getProductParents(target_id VARCHAR(50)) 
    RETURNS TABLE (parent_class_id INTEGER, 
                    parent_name VARCHAR(50), 
                    parent_ei_id INTEGER, 
                    parent_parent_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product WHERE prod_id = target_id) = 0 
        THEN RETURN QUERY SELECT 0, '0', 0, 0;
    ELSE
        RETURN QUERY WITH RECURSIVE parents AS (
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc WHERE pc.class_id = (SELECT class_id FROM product WHERE prod_id = target_id)
            UNION ALL
            SELECT pc.class_id, pc.name, pc.ei_id, pc.parent_class_id FROM product_classifier pc, parents p WHERE pc.class_id = p.parent_class_id
        ) SELECT * FROM parents;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Выбрать класс продукта
CREATE OR REPLACE FUNCTION selectProductParent(target_id VARCHAR(50)) 
RETURNS TABLE (result_class_id INTEGER, 
               result_name VARCHAR(50), 
               result_ei_id INTEGER, 
               result_parent_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product WHERE prod_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, '0', 0, 0;
    END IF;
    RETURN QUERY SELECT class_id, name, ei_id, parent_class_id FROM product_classifier WHERE class_id = (SELECT class_id FROM product WHERE prod_id = target_id);
END;
$$ LANGUAGE plpgsql;
  
-- Выбрать
CREATE OR REPLACE FUNCTION selectProduct(target_id VARCHAR(50)) 
RETURNS TABLE (result_prod_id VARCHAR(50), 
               result_name VARCHAR(50), 
               result_class_id INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product WHERE prod_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, '0', 0;
    END IF;
    RETURN QUERY SELECT prod_id, name, class_id FROM product WHERE prod_id = target_id;
END;
$$ LANGUAGE plpgsql;
  
-- Редактировать
CREATE OR REPLACE FUNCTION changeProduct(target_id VARCHAR(50), new_name VARCHAR(50)) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product WHERE prod_id = target_id) = 0 THEN
        RETURN 0;
    ELSE
        UPDATE product SET name = new_name WHERE prod_id = target_id;
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

--Просмотр графа классов до продукта 
CREATE OR REPLACE FUNCTION showClassTree(target_id VARCHAR(50))
RETURNS TABLE (class_names TEXT, 
			   product_name VARCHAR(50))
AS $$
DECLARE prod_class_id INTEGER;
DECLARE curr_class_id INTEGER;
BEGIN
prod_class_id = (SELECT class_id FROM product WHERE prod_id = target_id);
curr_class_id = 1;
RETURN QUERY WITH RECURSIVE parents(class_id, parent_class_id, name, path) AS (
	SELECT pc.class_id, pc.parent_class_id, pc.name, CAST (pc.name AS TEXT) as path
		FROM product_classifier pc WHERE pc.class_id=curr_class_id
	UNION ALL
	SELECT pc.class_id, pc.parent_class_id, pc.name, CAST ( p.path ||' = > '|| pc.name AS TEXT)
		FROM product_classifier pc INNER JOIN parents p ON( p.class_id = pc.parent_class_id) )
SELECT result.path, p.name FROM parents result LEFT JOIN product p on p.prod_id=target_id
WHERE result.class_id = prod_class_id
ORDER BY path, p.name;
END;
$$ LANGUAGE plpgsql;
  
/*Методы класса ei*/
--Создать единицу измерения
CREATE OR REPLACE FUNCTION addEi(new_name VARCHAR(50), new_short_name VARCHAR(25), new_code INTEGER) 
RETURNS TABLE (new_ei_id INTEGER, 
               success INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM ei WHERE (name = new_name) OR (short_name = new_short_name) OR (code = new_code)) = 0 THEN
        INSERT INTO ei(name, short_name, code) VALUES (new_name, new_short_name, new_code);
        RETURN QUERY SELECT ei_id, 1 FROM ei WHERE (name = new_name) OR (short_name = new_short_name) OR (code = new_code);
    ELSE
        RETURN QUERY SELECT ei_id, 0 FROM ei WHERE (name = new_name) OR (short_name = new_short_name) OR (code = new_code);
    END IF;
END;
$$ LANGUAGE plpgsql;
  
--Удалить единицу измерения
CREATE OR REPLACE FUNCTION deleteEi(target_id INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM ei WHERE ei_id = target_id) = 0 OR
    (SELECT COUNT(*) FROM product_classifier WHERE ei_id = target_id) > 1 THEN
        RETURN 0;
    ELSE
        DELETE FROM ei WHERE ei_id = target_id;
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
-- Редактировать
CREATE OR REPLACE FUNCTION changeEi(target_id INTEGER, new_name VARCHAR(50), new_short_name VARCHAR(25), new_code INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM ei WHERE ei_id = target_id) = 0 THEN
        RETURN 0;
    ELSE
        UPDATE ei SET name = new_name, short_name = new_short_name, code = new_code WHERE ei_id = target_id;
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;
  
-- Выбрать
CREATE OR REPLACE FUNCTION selectEi(target_id INTEGER) 
RETURNS TABLE (result_ei_id INTEGER, 
               result_name VARCHAR(50), 
               result_short_name VARCHAR(25), 
               result_code INTEGER) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM ei WHERE ei_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, '0', '0', 0;
    ELSE
        RETURN QUERY SELECT ei_id, name, short_name, code FROM ei WHERE ei_id = target_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

/*Методы класса product_specification*/
-- Создать позицию спецификации
CREATE OR REPLACE FUNCTION addProdSpec(new_prod_id VARCHAR(50), new_part_id VARCHAR(50), new_quantity INTEGER)
RETURNS TABLE (pos_num INTEGER,
			   prod_id VARCHAR(50),
			   part_id VARCHAR(50), 
			   quantity INTEGER)
AS $$
DECLARE position INTEGER;
BEGIN
position := (SELECT COUNT(*) FROM product_specification ps WHERE ps.prod_id = new_prod_id);
position := position +1;
INSERT INTO product_specification(prod_id, pos_num, part_id, quantity)
VALUES (new_prod_id, position, new_part_id, new_quantity);
RETURN QUERY SELECT * FROM product_specification;
END;
$$ LANGUAGE plpgsql;

-- Удалить позицию спецификации
CREATE OR REPLACE FUNCTION deleteProdSpec(target_id VARCHAR(50), target_pos_num INTEGER)
RETURNS TABLE (pos_num INTEGER,
			   prod_id VARCHAR(50),
			   part_id VARCHAR(50), 
			   quantity INTEGER)
AS $$
DECLARE curr_pos INTEGER;
BEGIN
DELETE FROM product_specification WHERE (prod_id = target_id AND pos_num = target_pos_num);
curr_pos := target_pos_num;
	WHILE (curr_pos < (SELECT COUNT(*) FROM product_specification ps WHERE ps.prod_id = target_id)+1)
	LOOP
	UPDATE product_specification SET pos_num = curr_pos WHERE (prod_id = target_id AND pos_num = corr_pos+1);
	curr_pos:= curr_pos +1;
	END LOOP;
RETURN QUERY SELECT * FROM product_specification;
END;
$$ LANGUAGE plpgsql;

-- Удалить всю спецификацию конкретного продукта
CREATE OR REPLACE FUNCTION deleteProdSpecOfProd(target_id VARCHAR(50))
RETURNS product_specification
AS $$
DELETE FROM product_specification
WHERE prod_id = target_id
RETURNING *;
$$ LANGUAGE sql;

-- Редактировать позицию спецификации
CREATE OR REPLACE FUNCTION changeProdSpec(target_id VARCHAR(50), target_pos_num INTEGER, new_part_id VARCHAR(50), new_quantity INTEGER) 
RETURNS INTEGER
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_specification WHERE (prod_id = target_id AND pos_num = target_pos_num)) = 0 THEN
        RETURN 0;
    ELSE
        UPDATE product_specification SET part_id = new_part_id, quantity = new_quantity WHERE (prod_id = target_id AND pos_num = target_pos_num);
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Вывести спецификацию продукта (со всеми уровнями вложенности)
CREATE OR REPLACE FUNCTION selectProdSpec(target_id VARCHAR(50)) 
RETURNS TABLE (result_pos_num INTEGER, 
               result_part_id VARCHAR(50), 
               result_part_name VARCHAR(50), 
               result_quantity INTEGER, 
			   result_ei_name VARCHAR(50)) 
AS $$
BEGIN
    IF (SELECT COUNT(*) FROM product_specification WHERE prod_id = target_id) = 0 THEN
        RETURN QUERY SELECT 0, 0, 0,'0', 0;
    ELSE
        RETURN QUERY WITH RECURSIVE children AS (
            SELECT ps.prod_id, ps.pos_num, ps.part_id, ps.quantity FROM product_specification ps WHERE prod_id = target_id
            UNION ALL
            SELECT ps.prod_id, ps.pos_num, ps.part_id, ps.quantity*c.quantity FROM product_specification ps, children c WHERE ps.prod_id = c.part_id
        ) SELECT c.pos_num, c.part_id, p.name, c.quantity, ei.name 
		FROM children c LEFT JOIN product p ON c.part_id = p.prod_id
						LEFT JOIN product_classifier pc ON p.class_id = pc.class_id
						LEFT JOIN ei ON pc.ei_id = ei.ei_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Рассчитать расходы 
CREATE OR REPLACE function countNeeds(target_id VARCHAR(50), amount INTEGER)
RETURNS TABLE (prod_id VARCHAR(50),
			   name VARCHAR(50),
               quantity INTEGER,
			   result_ei_name VARCHAR(50))
AS $$
BEGIN
    RETURN QUERY WITH RECURSIVE children (prod_id, part_id, quantity) AS (
            SELECT ps.prod_id, ps.part_id, ps.quantity*amount as new_amount FROM product_specification ps WHERE ps.prod_id = target_id
            UNION ALL
            SELECT ps.prod_id, ps.part_id, ps.quantity*c.quantity as final_amount FROM product_specification ps, children c WHERE ps.prod_id = c.part_id
    ) SELECT c.part_id, p.name, c.quantity, ei.name
	FROM children c LEFT JOIN product p ON c.part_id = p.prod_id
					LEFT JOIN product_classifier pc ON p.class_id = pc.class_id
					LEFT JOIN ei ON pc.ei_id = ei.ei_id;
END;
$$ LANGUAGE plpgsql;

-- Проверка на наличие циклов
CREATE OR REPLACE FUNCTION addProdSpecWithCheckLoops(new_prod_id VARCHAR(50), new_part_id VARCHAR(50), new_quantity INTEGER) 
RETURNS INTEGER 
AS $$
DECLARE
	curr_pos INTEGER;
	is_parent INTEGER;
BEGIN
	IF (SELECT COUNT(*) FROM product WHERE prod_id = new_prod_id) = 0 
	OR (SELECT COUNT(*) FROM product WHERE prod_id = new_part_id) = 0 
	THEN
		RETURN -1;
	END IF;
	is_parent := (WITH RECURSIVE parents(prod_id, part_id) AS (
		SELECT ps.prod_id, ps.part_id FROM product_specification ps WHERE ps.part_id = new_prod_id
        UNION ALL
        SELECT ps.prod_id, ps.part_id FROM product_specification ps, parents p WHERE ps.part_id = p.prod_id
	) SELECT COUNT(*) FROM parents p WHERE p.prod_id = new_part_id);
	IF  (SELECT COUNT(*) FROM product_specification WHERE prod_id = new_prod_id AND part_id = new_part_id) = 0 
	AND is_parent = 0 
	THEN
		curr_pos := (SELECT COUNT(*) FROM product_specification WHERE prod_id = new_prod_id) + 1;
		INSERT INTO product_specification (prod_id, pos_num, part_id, quantity) 
		VALUES (new_prod_id, curr_pos, new_part_id, new_quantity);
		RETURN 1;
	ELSE
		RETURN 0;
END IF;
END;
$$ LANGUAGE plpgsql;`;

const create = () => {
  pool.query(sql_create_table_func, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Все 4 таблицы и функции успешно созданы!");
    
    // Вставим данные в таблицы
    const sql_insert = `/*Заполнение таблиц*/
    SELECT addEi('Штука', 'шт', 10);
    SELECT addEi('Вес', 'кг', 11);
    
    SELECT createRootClass('Изделие', 1);
    SELECT createClass('Диваны', 2, 1);
    SELECT createClass('Кресла', 2, 1);
    SELECT createClass('Детали', 1, 1);
    SELECT createClass('Прямые диваны', 2, 2);
    SELECT createClass('Угловые диваны', 2, 2);
    SELECT createClass('Простые кресла', 2, 3);
    SELECT createClass('Кресла-кровати', 2, 3);
    SELECT createClass('Механизмы', 1, 4);
    SELECT createClass('Царги', 1, 4);
    SELECT createClass('Подлокотники', 1, 4);
    SELECT createClass('Ножки', 1, 4);
    SELECT createClass('Спинки', 1, 4);
    SELECT createClass('Боковины', 1, 4);
    SELECT createClass('Подушки', 1, 4);
    SELECT createClass('Чехлы', 1, 4);
    SELECT createClass('Матрасы', 1, 4);
    SELECT createClass('Секции/модули', 1, 4);
    SELECT createClass('Фурнитура', 1, 4);
    SELECT createClass('Болты', 1, 19);
    SELECT createClass('Шайбы', 1, 19);
    SELECT createClass('Винты', 1, 19);
    SELECT createClass('Гайки', 1, 19);
    SELECT createClass('Ключи', 1, 19);
    
    SELECT createProduct('1', 'Кресло-реклайнер Хоган', 8);
    SELECT createProduct('2', 'Диван угловой Домо ПРО', 6);
    SELECT createProduct('3', 'Диван угловой серии Кларк', 6);
    SELECT createProduct('4', 'Кресло Хюгге', 7);
    SELECT createProduct('5', 'Кресло Муни', 7);
    SELECT createProduct('6', 'Диван Ника', 5);
    SELECT createProduct('7', 'Диван-кровать Литен', 5);
    SELECT createProduct('8', 'Кресло-кровать Персей Nova', 8);
    
    SELECT createProduct('Д32', 'Модуль Кресло', 18);
    SELECT createProduct('Д06', 'Подлокотник', 11);
    SELECT createProduct('ДФ07', 'Болт M8*60 DIN 933', 20);
    SELECT createProduct('ДФ42', 'Шайба M8 DIN 9021 увеличенная', 21);
    SELECT createProduct('ДФ84', 'Механизм трансформации', 9);
    SELECT createProduct('FMP113', 'Болт 6*20 DIN 933  ', 20);
    SELECT createProduct('FMP068', 'Болт 6*40 DIN 933', 20);
    SELECT createProduct('FMP078', 'Болт 8*45 DIN 933', 20);
    SELECT createProduct('FMP008', 'Винт 6*16 DIN 965', 22);
    SELECT createProduct('FMP086', 'Винт 6*25 DIN 7420', 22);
    SELECT createProduct('FMP004', 'Винт 6*50 DIN 7420', 22);
    SELECT createProduct('FMP030', 'Винт 6*70 DIN 7420', 22);
    SELECT createProduct('FMP045', 'Гайка 6 DIN 985', 23);
    SELECT createProduct('FMP096', 'Гайка 8 DIN 985', 23);
    SELECT createProduct('FOP053', 'Ключ шестигранный 4 DIN 911', 24);
    SELECT createProduct('FMP103', 'Шайба 24*8 пластик', 21);
    SELECT createProduct('FMP064', 'Шайба 6 DIN 9021 увеличенная', 21);
    SELECT createProduct('Д37', 'Центральная секция', 18);
    SELECT createProduct('Д04', 'Спинка', 13);
    SELECT createProduct('Д33', 'Подушка приспинная', 15);
    SELECT createProduct('ДФ98', 'Болт М8*30 DIN 933 ', 20);
    SELECT createProduct('ДФ82', 'Шайба 24х8 (пнд)', 21);
    SELECT createProduct('ДФ17', 'Гайка М8 самоконтр DIN 985', 23);
    SELECT createProduct('ДФ114', 'Гайка М8 ERICSON', 23);
    SELECT createProduct('ДФ53', 'Болт М8*40 DIN 933', 18);
    SELECT createProduct('ДФ113', 'Ключ шестигранный №5 ', 18);
    SELECT createProduct('Д100', 'Подушка сиденья', 15);
    SELECT createProduct('ДФ126', 'Шайба пластмассовая d9/d40*2', 21);
    SELECT createProduct('ДФ101', 'Болт 8*60 DIN 933', 20);
    SELECT createProduct('Д15', 'Модуль Кресло', 18);
    SELECT createProduct('РФ21', 'Рама спинки', 13);
    SELECT createProduct('РФ24', 'Подъемный механизм', 9);
    SELECT createProduct('РФ25', 'Винт М8x40', 22);
    SELECT createProduct('РФ26', 'Винт М8x45', 22);
    SELECT createProduct('РФ05', 'Гайка М8', 23);
    SELECT createProduct('Д07', 'Чехол дивана', 16);
    SELECT createProduct('Д20', 'Матрас', 17);
    SELECT createProduct('Д01', 'Механизм трансформации', 9);
    SELECT createProduct('ДФ08', 'Болт M8*70 DIN 933', 20);
    SELECT createProduct('ДФ78', 'Винт M8*50 DIN 7985', 22);
    SELECT createProduct('ДФ19', 'Гайка М8 DIN 6923', 23);
    SELECT createProduct('ДФ11', 'Винт-потай M6*30', 22);
    SELECT createProduct('ДФ54', 'Болт M8*55', 20);
    SELECT createProduct('Т01', 'Ткань для подлокотника', 16);
    SELECT createProduct('О01', 'Основание подлокотника', 11);
    
    SELECT addProdSpec('1', 'Д32', 1);
    SELECT addProdSpec('1', 'Д06', 2);
    SELECT addProdSpec('1', 'ДФ07', 2);
    SELECT addProdSpec('1', 'ДФ42', 2);
    
    SELECT addProdSpec('2', 'ДФ84', 1);
    SELECT addProdSpec('2', 'FMP113', 3);
    SELECT addProdSpec('2', 'FMP068', 2);
    SELECT addProdSpec('2', 'FMP078', 2);
    SELECT addProdSpec('2', 'FMP008', 4);
    SELECT addProdSpec('2', 'FMP086', 4);
    SELECT addProdSpec('2', 'FMP004', 4);
    SELECT addProdSpec('2', 'FMP030', 2);
    SELECT addProdSpec('2', 'FMP045', 7);
    SELECT addProdSpec('2', 'FMP096', 2);
    SELECT addProdSpec('2', 'FOP053', 1);
    SELECT addProdSpec('2', 'FMP103', 2);
    SELECT addProdSpec('2', 'FMP064', 8);
    SELECT addProdSpec('2', 'Д04', 1);
    SELECT addProdSpec('2', 'Д06', 2);
    
    SELECT addProdSpec('3', 'Д37', 1);
    SELECT addProdSpec('3', 'Д04', 1);
    SELECT addProdSpec('3', 'Д33', 1);
    SELECT addProdSpec('3', 'Д06', 2);
    SELECT addProdSpec('3', 'ДФ98', 2);
    SELECT addProdSpec('3', 'ДФ82', 10);
    SELECT addProdSpec('3', 'ДФ42', 10);
    SELECT addProdSpec('3', 'ДФ17', 2);
    SELECT addProdSpec('3', 'ДФ114', 2);
    SELECT addProdSpec('3', 'ДФ53', 2);
    SELECT addProdSpec('3', 'ДФ113', 1);
    
    SELECT addProdSpec('4', 'Д100', 1);
    SELECT addProdSpec('4', 'Д04', 1);
    SELECT addProdSpec('4', 'Д06', 2);
    SELECT addProdSpec('4', 'ДФ42', 6);
    SELECT addProdSpec('4', 'ДФ126', 4);
    SELECT addProdSpec('4', 'ДФ101', 6);
    
    SELECT addProdSpec('5', 'Д15', 1);
    SELECT addProdSpec('5', 'Д100', 1);
    SELECT addProdSpec('5', 'ДФ42', 4);
    SELECT addProdSpec('Д15', 'Д04', 1);
    SELECT addProdSpec('Д15', 'Д06', 2);
    SELECT addProdSpec('Д06', 'Т01', 1);
    SELECT addProdSpec('Д06', 'О01', 1);
    
    SELECT addProdSpec('6', 'РФ21', 1);
    SELECT addProdSpec('6', 'РФ24', 2);
    SELECT addProdSpec('6', 'РФ05', 20);
    SELECT addProdSpec('6', 'РФ25', 12);
    SELECT addProdSpec('6', 'РФ26', 8);
    SELECT addProdSpec('6', 'Д07', 1);
    SELECT addProdSpec('6', 'Д20', 1);
    
    SELECT addProdSpec('7', 'Д01', 1);
    SELECT addProdSpec('7', 'Д07', 1);
    SELECT addProdSpec('7', 'Д20', 1);
    SELECT addProdSpec('7', 'Д04', 1);
    SELECT addProdSpec('7', 'ДФ08', 4);
    SELECT addProdSpec('7', 'ДФ78', 4);
    SELECT addProdSpec('7', 'ДФ19', 2);
    SELECT addProdSpec('7', 'ДФ42', 4);
    
    SELECT addProdSpec('8', 'Д01', 1);
    SELECT addProdSpec('8', 'Д07', 1);
    SELECT addProdSpec('8', 'Д20', 1);
    SELECT addProdSpec('8', 'Д04', 1);
    SELECT addProdSpec('8', 'Д06', 2);
    SELECT addProdSpec('8', 'ДФ42', 4);
    SELECT addProdSpec('8', 'ДФ11', 3);
    SELECT addProdSpec('8', 'ДФ54', 12);`;
    
    pool.query(sql_insert, [], (err, result) => {
      if (err) {
        return console.error(err.message);
      }
      console.log("Данные успешно вставлены!");
    });
  });
}

module.exports = {
  create
}