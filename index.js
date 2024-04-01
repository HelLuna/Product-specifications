const express = require("express");
const db = require('./scripts/queries');
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: false }));

db.create();

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server started ${PORT}.`);
});

app.get("/", (req, res) => {
  res.render ("index");
});

// Отображения основных страниц
app.get("/classes", db.getAllClasses);
app.get("/products", db.getAllProducts);
app.get("/ei", db.getAllEis);
app.get("/specifications", db.getAllSpecs);

// Работа с классами изделий
app.get("/selected-class/:class_id", db.getClassID);
app.get("/selected-class/find-class-desc/:class_id", db.findClassDesc);
app.get("/selected-class/find-class-desc-prod/:class_id", db.findClassDescProd);
app.get("/selected-class/find-parent-class/:class_id", db.findClassParent);
app.get("/selected-class/find-class-products/:class_id", db.findClassProds);

app.get("/create-class", db.getToCreateClass);
app.post("/create-class", db.createClass);

app.get("/edit-class/:class_id", db.getForEditClass);
app.post("/edit-class/:class_id", db.editClass);

app.get("/delete-class/:class_id", db.getForDelete);
app.post("/delete-class/:class_id", (req, res) => {
  if (req.body.action === "Удалить") {
    db.deleteClass(req, res);
  } else if (req.body.action === "Удалить с потомками") {
    db.deleteClassWithDep(req, res);
  } else {
    console.error("Action not found!");
  }
});

// Работа со списком изделий
app.get("/create-product", db.getToCreateProduct);
app.post("/create-product", db.createProduct);

app.get("/delete-product/:prod_id", db.getForDeleteProd);
app.post("/delete-product/:prod_id", db.deleteProduct);

app.get("/edit-product/:prod_id", db.getForEditProduct);
app.post("/edit-product/:prod_id", db.editProduct);

app.get("/selected-product/:prod_id", db.getProdID);
app.get("/selected-product/find-classes/:prod_id", db.findClasses);
app.get("/selected-product/find-parents/:prod_id", db.findParents);

// Работа с единицами измерений
app.get("/create-ei", db.getToCreateEi);
app.post("/create-ei", db.createEi);

app.get("/edit-ei/:ei_id", db.getForEditEi);
app.post("/edit-ei/:ei_id", db.editEi);

app.get("/delete-ei/:ei_id", db.getForDeleteEi);
app.post("/delete-ei/:ei_id", db.deleteEi);

// Работа со спецификациями
app.get("/create-spec", db.getToCreateSpec);
app.post("/create-spec", db.createSpec);

app.get("/selected-spec-prod/:prod_id", db.findSpec);

app.get("/find-cost-form/:prod_id", db.findCostForm);
app.post("/find-cost/:prod_id", db.findCost);