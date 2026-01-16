let user = "";
let comps = JSON.parse(localStorage.getItem("comps")) || [];
let winners = JSON.parse(localStorage.getItem("winners")) || [];

function setName() {
  user = document.getElementById("username").value;
  alert("Welcome " + user);
}

function adminLogin() {
  if (document.getElementById("adminPass").value === "admin123") {
    document.getElementById("admin").style.display = "block";
  } else {
    alert("Wrong password");
  }
}

function addComp() {
  const c = {
    name: name.value,
    price: Number(price.value),
    image: image.value,
    total: 0,
    tickets: []
  };
  comps.push(c);
  save();
  render();
}

function buy(i) {
  if (!user) return alert("Enter your name first");
  comps[i].tickets.push(user);
  comps[i].total += comps[i].price;

  if (comps[i].total >= 1000) {
    const winner = comps[i].tickets[Math.floor(Math.random()*comps[i].tickets.length)];
    winners.push(`${winner} won ${comps[i].name}`);
    comps[i].total = 0;
    comps[i].tickets = [];
  }

  save();
  render();
}

function save() {
  localStorage.setItem("comps", JSON.stringify(comps));
  localStorage.setItem("winners", JSON.stringify(winners));
}

function render() {
  competitions.innerHTML = "";
  comps.forEach((c,i)=>{
    competitions.innerHTML += `
      <div class="comp">
        <h3>${c.name}</h3>
        <img src="${c.image}">
        <p>£${c.price} per ticket</p>
        <p>Collected: £${c.total}</p>
        <button onclick="buy(${i})">Buy Ticket</button>
      </div>`;
  });

  winnersList.innerHTML = "";
  winners.forEach(w=> winnersList.innerHTML += `<li>${w}</li>`);
}

render();