const $ = id => document.getElementById(id);
const store = key => JSON.parse(localStorage.getItem(key) || '[]');

const ADMIN_PASS = "1234"; // change later

let user = localStorage.getItem("user") || "";

if ($("year")) $("year").textContent = new Date().getFullYear();

if ($("confirmNameBtn")) {
  $("confirmNameBtn").onclick = () => {
    user = $("username").value.trim();
    if (!user) return;
    localStorage.setItem("user", user);
    $("userStatus").textContent = "Welcome " + user;
  };
}

function comps() { return store("comps"); }
function saveComps(c) { localStorage.setItem("comps", JSON.stringify(c)); }

function renderPublic() {
  if (!$("compGrid")) return;
  $("compGrid").innerHTML = "";
  comps().forEach(c => {
    $("compGrid").innerHTML += `
      <div class="comp">
        <img class="comp__img" src="${c.image}">
        <div class="comp__body">
          <h3>${c.name}</h3>
          <p>£${c.price}</p>
          <button class="btn btn--buy">PayPal</button>
        </div>
      </div>`;
  });
}
renderPublic();

/* ADMIN */
if (document.body.dataset.page === "admin") {
  $("adminLoginBtn").onclick = () => {
    if ($("adminPass").value === ADMIN_PASS) {
      $("adminPanel").classList.remove("hidden");
      $("adminPanel2").classList.remove("hidden");
      $("adminStatus").textContent = "Logged in";
    } else {
      $("adminStatus").textContent = "Wrong password";
    }
  };

  $("saveCompBtn").onclick = () => {
    const c = {
      name: $("a_name").value,
      price: $("a_price").value,
      image: $("a_image").value
    };
    const list = comps();
    list.push(c);
    saveComps(list);
    alert("Saved");
  };
}