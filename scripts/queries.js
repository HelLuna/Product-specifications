const pool = require('./pool').pool;
const create = require('./creation').create;

// Запросы для отображения всех страниц
const getAllClasses = (req, res) => {
  const sql = `SELECT pc.class_id, pc.parent_class_id, pc.name, ei.short_name
  FROM product_classifier AS pc
  INNER JOIN ei ON pc.ei_id = ei.ei_id
  ORDER BY pc.class_id ASC;`
  
  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("classes", { model: result.rows });
  });
};

const getAllProducts = (req, res) => {
  const sql = `SELECT p.prod_id, p.name AS prod_name, pc.name AS par_name, ei.short_name
  FROM product AS p
  INNER JOIN product_classifier AS pc ON p.class_id = pc.class_id
  INNER JOIN ei ON pc.ei_id = ei.ei_id
  ORDER BY p.prod_id;`
  
  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("products", { model: result.rows });
  });
};

const getAllSpecs = (req, res) => {
  const sql = `SELECT pos_num, ps.prod_id, p.name AS p_name, ps.part_id, pt.name AS part_name, quantity
  FROM product_specification AS ps
  INNER JOIN product AS p ON ps.prod_id = p.prod_id
  INNER JOIN product AS pt ON ps.part_id = pt.prod_id;`
  
  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("specifications", { model: result.rows });
  });
};

const getAllEis = (req, res) => {
  const sql = `SELECT *
  FROM ei
  ORDER BY ei_id ASC;`
  
  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("ei", { model: result.rows });
  });
};

// Запросы для работы с классами изделий
const getToCreateClass = (req, res) => {
  res.render("create-class", { model: {} });
};

const createClass = (req, res) => {
  const sql = `SELECT createClass($1, $2, $3);`;
  const newClass = [req.body.name, req.body.ei_id, req.body.parent_class_id];
  
  pool.query(sql, newClass, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/classes");
  });
};

const getForEditClass = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT result_class_id AS class_id, result_name AS name, result_ei_id AS ei_id, result_parent_class_id AS parent_class_id
  FROM selectClass($1);`;
  
  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("edit-class", { model: result.rows[0] });
  });
};

const editClass = (req, res) => {
  const id = req.body.class_id;
  const upd_class = [id, req.body.name, req.body.ei_id, req.body.parent_class_id];
  const sql = `SELECT (changepc + changepcparent = 2)::int  AS change FROM changePc($1, $2, $3), changePcParent($1, $4);`;
  
  pool.query(sql, upd_class, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/classes");
  });
};

const getForDelete = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT *
  FROM product_classifier WHERE class_id = $1`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("delete-class", { model: result.rows[0] });
  });
};

const deleteClass = (req, res) => {
  const id = req.params.class_id;
  const sql = "SELECT deleteClass($1)";

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/classes");
  });
};

const deleteClassWithDep = (req, res) => {
  const id = req.params.class_id;
  const sql = "SELECT deleteClassAndDesc($1)";

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/classes");
  });
};

const getClassID = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT *
  FROM product_classifier WHERE class_id = $1`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("selected-class", { model: result.rows[0] });
  });
};

const findClassDesc = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT result_class_id AS class_id, result_name AS name, ei.short_name AS ei_name, result_parent_class_id AS parent_class_id
  FROM selectPcChildren($1) AS spc
  INNER JOIN ei ON spc.result_ei_id = ei.ei_id`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-class-desc", { model: result.rows });
  });
};

const findClassDescProd = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT *
  FROM selectPcChildrenWithProducts($1) AS spcw
  INNER JOIN ei ON spcw.result_ei_id = ei.ei_id`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-class-desc-prod", { model: result.rows });
  });
};

const findClassParent = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT result_class_id AS class_id, result_name AS name, ei.short_name AS ei_name, result_parent_class_id AS parent_class_id
  FROM selectPcParents($1) AS spp
  INNER JOIN ei ON spp.result_ei_id = ei.ei_id`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-parent-class", { model: result.rows });
  });
};

const findClassProds = (req, res) => {
  const id = req.params.class_id;
  const sql = `SELECT *
  FROM selectClassProd($1) AS scp
  INNER JOIN product_classifier AS pc ON scp.result_class_id = pc.class_id;`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-class-products", { model: result.rows });
  });
};

// Запросы для работы с изделиями
const getToCreateProduct = (req, res) => {
  res.render("create-product", { model: {} });
};

const createProduct = (req, res) => {
  const sql = `SELECT createProduct($1, $2, $3);`;
  const newProd = [req.body.prod_id, req.body.name, req.body.class_id];
  
  pool.query(sql, newProd, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/products");
  });
};

const getForEditProduct = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT result_prod_id AS prod_id, result_name AS name, result_class_id AS class_id
  FROM selectProduct($1);`;
  
  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("edit-product", { model: result.rows[0] });
  });
};

const editProduct = (req, res) => {
  const id = req.body.prod_id;
  const upd_class = [id, req.body.name, req.body.class_id];
  const sql = `SELECT (changeProduct + changeProductParent = 2)::int AS change
  FROM changeProduct($1, $2), changeProductParent($1, $3);`;
  
  pool.query(sql, upd_class, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/products");
  });
};

const getForDeleteProd = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT *
  FROM product WHERE prod_id = $1`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("delete-product", { model: result.rows[0] });
  });
};

const deleteProduct = (req, res) => {
  const id = req.params.prod_id;
  const sql = "SELECT deleteProduct($1)";

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/products");
  });
};

const getProdID = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT *
  FROM product WHERE prod_id = $1`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("selected-product", { model: result.rows[0] });
  });
};

const findClasses = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT * FROM showClassTree($1);`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-classes", { model: result.rows });
  });
};

const findParents = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT * FROM getProductParents($1);`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-parents", { model: result.rows });
  });
};

// Запросы для работы с единицами измерений
const getToCreateEi = (req, res) => {
  res.render("create-ei", { model: {} });
};

const createEi = (req, res) => {
  const sql = `SELECT addEi($1, $2, $3);`;
  const newEi = [req.body.name, req.body.short_name, req.body.code];
  
  pool.query(sql, newEi, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/ei");
  });
};

const getForEditEi = (req, res) => {
  const id = req.params.ei_id;
  const sql = `SELECT result_ei_id AS ei_id, result_name AS name, result_short_name AS short_name, result_code AS code
  FROM selectEi($1);`;
  
  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("edit-ei", { model: result.rows[0] });
  });
};

const editEi = (req, res) => {
  const id = req.body.ei_id;
  const upd_class = [id, req.body.name, req.body.short_name, req.body.code];
  const sql = `SELECT changeEi($1, $2, $3, $4);`;
  
  pool.query(sql, upd_class, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/ei");
  });
};

const getForDeleteEi = (req, res) => {
  const id = req.params.ei_id;
  const sql = `SELECT *
  FROM ei WHERE ei_id = $1`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("delete-ei", { model: result.rows[0] });
  });
};

const deleteEi = (req, res) => {
  const id = req.params.ei_id;
  const sql = "SELECT deleteEi($1)";

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/ei");
  });
};

// Запросы для работы со спецификациями
const getToCreateSpec = (req, res) => {
  res.render("create-spec", { model: {} });
};

const createSpec = (req, res) => {
  const sql = `SELECT addProdSpecWithCheckLoops($1, $2, $3);`;
  const newSpec = [req.body.prod_id, req.body.part_id, req.body.quantity];
  
  pool.query(sql, newSpec, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.redirect("/specifications");
  });
};

const findSpec = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT * FROM selectProdSpec($1);`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }

    res.render("selected-spec-prod", { model: result.rows });
  });
};

const findCostForm = (req, res) => {
  const id = req.params.prod_id;
  const sql = `SELECT *
  FROM product WHERE prod_id = $1`;

  pool.query(sql, [id], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-cost-form", { model: result.rows[0] });
  });
};

const findCost = (req, res) => {
  const id = req.body.prod_id;
  const sql = `SELECT prod_id, name, SUM(quantity) AS quantity, result_ei_name
  FROM countNeeds($1, $2)
  GROUP BY prod_id, name, result_ei_name;`;

  pool.query(sql, [id, req.body.amount], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    res.render("find-cost", { model: result.rows });
  });
};

module.exports = {
  pool,
  create,
  getAllClasses,
  getAllProducts,
  getAllEis,
  getAllSpecs,

  getClassID,
  findClassDesc,
  findClassDescProd,
  findClassParent,
  findClassProds,
  getToCreateClass,
  createClass,
  getForEditClass,
  editClass,
  getForDelete,
  deleteClass,
  deleteClassWithDep,

  getToCreateProduct,
  createProduct,
  getForDeleteProd,
  deleteProduct,
  getForEditProduct,
  editProduct,
  getProdID,
  findClasses,
  findParents,

  getToCreateEi,
  createEi,
  getForEditEi,
  editEi,
  getForDeleteEi,
  deleteEi,

  getToCreateSpec,
  createSpec,
  findSpec,
  findCostForm,
  findCost
}