const TAGS = ["waakye", "pizza", "shawarma", "breakfast", "kenkey", "chicken"];
const tags = (n) => TAGS.filter((t) => n.toLowerCase().includes(t));
const key = (n) => n.trim().toLowerCase();
const pct = (a, b) => ((a / b) * 100).toFixed(1) + "%";

let data, filter = "all", query = "";

fetch("./roster.json")
  .then((r) => r.json())
  .then((json) => {
    data = json;
    document.getElementById("asof").textContent = json.asOfLabel;
    document.getElementById("lead").textContent =
      json.product.subtitle +
      " for Ghana food delivery. Two ops lanes, one roster — names exactly as submitted, counts computed from the lists.";
    bind();
    render();
  });

function bind() {
  document.querySelectorAll(".bar button").forEach((btn) => {
    btn.onclick = () => {
      filter = btn.dataset.f;
      document.querySelectorAll(".bar button").forEach((b) => b.classList.toggle("on", b === btn));
      render();
    };
  });
  document.getElementById("q").oninput = (e) => {
    query = e.target.value;
    render();
  };
}

function match(name) {
  return !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
}

function model() {
  const overlapMap = new Map(data.overlaps.map((o) => [o.roselineName, o.ibrahimChain]));
  const roseline = data.roseline.vendors.map((name, i) => ({
    stall: i + 1,
    name,
    tags: tags(name),
    overlap: overlapMap.has(name),
    chain: overlapMap.get(name) || null,
  }));
  const seen = new Map();
  const byChain = new Map();
  data.overlaps.forEach((o) => {
    byChain.set(o.ibrahimChain, [...(byChain.get(o.ibrahimChain) || []), o.roselineName]);
  });
  const ibrahim = data.ibrahim.brands.map((b, i) => {
    const k = key(b.name);
    const prior = seen.get(k) || 0;
    seen.set(k, prior + 1);
    const branches = typeof b.branches === "number" ? b.branches : null;
    return {
      stall: i + 1,
      name: b.name,
      tags: tags(b.name),
      branches,
      chain: branches !== null,
      dup: prior > 0,
      key: k,
      live: byChain.get(b.name) || [],
    };
  });
  const unique = new Set(ibrahim.map((r) => r.key));
  const chains = ibrahim.filter((r) => r.chain);
  const chainKeys = new Set(chains.map((r) => r.key));
  const singles = ibrahim.filter((r) => !r.chain && !chainKeys.has(r.key)).length;
  const w2 = data.augustContext.weeks[0];
  const w3 = data.augustContext.weeks[1];
  return {
    roseline,
    ibrahim,
    chains,
    unique: unique.size,
    singles,
    locs: chains.reduce((s, r) => s + r.branches, 0),
    w2,
    w3,
  };
}

function chip(label, warn) {
  return `<span class="tag${warn ? " warn" : ""}">${label}</span>`;
}

function render() {
  const m = model();
  const q = query;
  document.getElementById("kpis").innerHTML = [
    ["Roseline live", m.roseline.length, "Taken live this roster"],
    ["Ibrahim brands", data.ibrahim.brands.length, m.unique + " unique after MaxMart de-dupe"],
    ["Ibrahim chain locations", m.locs, m.chains.length + " chains · branch spots"],
    ["Overlaps", data.overlaps.length, "Same chain branch, both lists"],
  ]
    .map(
      ([l, v, h]) =>
        `<article class="kpi"><span>${l}</span><strong>${v}</strong><small>${h}</small></article>`
    )
    .join("");

  document.getElementById("ctx").innerHTML = `
    <h3>Context</h3>
    <p class="muted">${data.augustContext.disclaimer}</p>
    <div class="ctx-grid">
      <div><h3>${m.w2.label} · Roseline</h3><p class="sub" style="font-size:20px;margin:4px 0">${m.w2.fullyOnboarded} of ${m.w2.reviewed}</p><p class="muted">fully onboarded · ${pct(m.w2.fullyOnboarded, m.w2.reviewed)}</p></div>
      <div><h3>${m.w3.label} · Roseline</h3><p class="sub" style="font-size:20px;margin:4px 0">${m.w3.fullyOnboarded} of ${m.w3.reviewed}</p><p class="muted">fully onboarded · ${pct(m.w3.fullyOnboarded, m.w3.reviewed)}</p></div>
      <div><h3>Combined Aug weeks 2–3</h3><p class="sub" style="font-size:20px;margin:4px 0">${m.w2.fullyOnboarded + m.w3.fullyOnboarded} of ${m.w2.reviewed + m.w3.reviewed}</p><p class="muted">this roster is those 54 names</p></div>
    </div>`;

  document.getElementById("notes").innerHTML = `
    <article class="note"><h3>Overlap — not double-credit</h3>
      <p>Roseline already took live these branches of Ibrahim’s chains. They stay on both lists; they are not extra unique vendors live. Unique brands if those three are not double-credited: 54 + 24 − 3 = 75.</p>
      <ul>${data.overlaps.map((o) => `<li><b>${o.roselineName}</b> <span class="muted">↔ ${o.ibrahimChain}</span></li>`).join("")}</ul>
    </article>
    <article class="note"><h3>How Ibrahim is counted</h3>
      <p>${data.notes.maxMart}</p>
      <p>Submitted rows stay at 25. Unique brand names: ${m.unique}. Singles with no branch count: ${m.singles}. Chain branch spots sum to 80 on the seven named chains.</p>
    </article>`;

  const showR = filter === "all" || filter === "roseline" || filter === "overlap";
  const showI = filter === "all" || filter === "ibrahim" || filter === "chains" || filter === "overlap";
  const showC = filter === "all" || filter === "ibrahim" || filter === "chains";

  const rv = m.roseline.filter((r) => match(r.name) && (filter !== "overlap" || r.overlap) && filter !== "ibrahim" && filter !== "chains");
  const iv = m.ibrahim.filter((r) => {
    if (!match(r.name) && !r.live.some(match)) return false;
    if (filter === "roseline") return false;
    if (filter === "chains") return r.chain;
    if (filter === "overlap") return r.live.length > 0;
    return true;
  });

  let cols = "";
  if (showR) {
    cols += col(
      "Taken Live",
      data.roseline.name,
      `${rv.length} of ${m.roseline.length}`,
      rv
        .map(
          (r) => `<li class="row"><span class="num">${String(r.stall).padStart(2, "0")}</span><div><div class="name">${r.name}</div><div class="tags">${
            r.overlap ? chip("Overlap · " + r.chain, 1) : ""
          }${r.tags.map((t) => chip(t)).join("")}</div></div></li>`
        )
        .join("") || empty("No Roseline stalls match that search.")
    );
  }
  if (showI) {
    cols += col(
      data.ibrahim.role,
      data.ibrahim.name + " / " + data.ibrahim.alsoKnownAs,
      `${iv.length} of ${data.ibrahim.brands.length} submitted`,
      iv
        .map((r) => {
          const extra = [
            r.dup ? chip("Same brand as earlier MaxMart row") : "",
            ...r.live.map((loc) => chip("Live on Roseline · " + loc, 1)),
            ...r.tags.map((t) => chip(t)),
          ].join("");
          return `<li class="row"><span class="num">${String(r.stall).padStart(2, "0")}</span><div style="flex:1"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="name">${r.name}</span><span class="muted">${r.branches != null ? r.branches + " branches" : "single"}</span></div><div class="tags">${extra}</div></div></li>`;
        })
        .join("") || empty("No Ibrahim brands match that search."),
      `${m.unique} unique brands · ${m.singles} singles · ${m.locs} chain locations`
    );
  }
  document.getElementById("cols").innerHTML = cols;

  const chart = document.getElementById("chart");
  if (!showC) {
    chart.style.display = "none";
    return;
  }
  chart.style.display = "";
  const max = Math.max(...m.chains.map((c) => c.branches), 1);
  chart.innerHTML = `<h2>Seven chains, 80 branch spots</h2><p class="muted">Ibrahim · chain coverage</p><ul>${m.chains
    .map(
      (c) =>
        `<li><div><div class="name">${c.name}</div>${
          c.live.length ? `<div class="muted">Overlap: ${c.live.join(", ")}</div>` : ""
        }</div><div class="track"><div class="fill" style="width:${(c.branches / max) * 100}%"></div></div><strong>${c.branches}</strong></li>`
    )
    .join("")}</ul>`;
}

function col(eyebrow, title, count, body, meta) {
  return `<section class="panel"><div style="display:flex;justify-content:space-between;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:8px"><div><p class="kicker">${eyebrow}</p><h2>${title}</h2>${
    meta ? `<p class="muted">${meta}</p>` : ""
  }</div><span class="count">${count}</span></div>${body}</section>`;
}
function empty(t) {
  return `<p class="empty">${t}</p>`;
}
