export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined) node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== undefined && child !== null));
  return node;
}

export function button(label, action, className = "") {
  return el("button", { type: "button", class: className, onclick: action }, label);
}
