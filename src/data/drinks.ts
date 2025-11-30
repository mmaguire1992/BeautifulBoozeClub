export type DrinkCost = {
  id: string;
  name: string;
  cost: number;
  customerPrice: number;
};

export const BEER_COSTS: DrinkCost[] = [
  { id: "coors-light", name: "Coors Light", cost: 0.62, customerPrice: 3.0 },
  { id: "heineken", name: "Heineken Lager", cost: 0.86, customerPrice: 3.25 },
  { id: "corona", name: "Corona Extra", cost: 1.04, customerPrice: 3.5 },
  { id: "moretti", name: "Birra Moretti Lager", cost: 0.93, customerPrice: 3.3 },
];

export const COCKTAIL_COSTS: DrinkCost[] = [
  { id: "pornstar-martini", name: "Pornstar Martini", cost: 2.95, customerPrice: 4.62 },
  { id: "espresso-martini", name: "Espresso Martini", cost: 2.7, customerPrice: 4.37 },
  { id: "cosmopolitan", name: "Cosmopolitan", cost: 2.5, customerPrice: 4.17 },
  { id: "margarita", name: "Margarita", cost: 2.8, customerPrice: 4.47 },
  { id: "martini", name: "Martini", cost: 2.1, customerPrice: 3.77 },
  { id: "aviation", name: "Aviation", cost: 2.65, customerPrice: 4.32 },
  { id: "boulevardier", name: "Boulevardier", cost: 3.2, customerPrice: 4.87 },
  { id: "bacardi-cocktail", name: "Bacardi Cocktail", cost: 2.45, customerPrice: 4.12 },
  { id: "clover-club", name: "Clover Club", cost: 2.55, customerPrice: 4.22 },
  { id: "daiquiri", name: "Daiquiri", cost: 2.3, customerPrice: 3.97 },
  { id: "manhattan", name: "Manhattan", cost: 3.1, customerPrice: 4.77 },
  { id: "white-lady", name: "White Lady", cost: 2.4, customerPrice: 4.07 },
  { id: "negroni", name: "Negroni", cost: 2.9, customerPrice: 4.57 },
  { id: "americano", name: "Americano", cost: 2.2, customerPrice: 3.87 },
  { id: "spritz", name: "Spritz", cost: 2.8, customerPrice: 4.47 },
  { id: "woo-woo", name: "Woo Woo", cost: 2.35, customerPrice: 4.02 },
  { id: "old-fashioned", name: "Old Fashioned", cost: 3.0, customerPrice: 4.67 },
  { id: "whiskey-sour", name: "Whiskey Sour", cost: 2.75, customerPrice: 4.42 },
  { id: "mimosa", name: "Mimosa", cost: 1.85, customerPrice: 3.52 },
  { id: "kir", name: "Kir", cost: 2.0, customerPrice: 3.67 },
  { id: "french-75", name: "French 75", cost: 2.6, customerPrice: 4.27 },
  { id: "mojito", name: "Mojito", cost: 2.3, customerPrice: 3.97 },
  { id: "gin-basil-smash", name: "Gin Basil Smash", cost: 2.45, customerPrice: 4.12 },
  { id: "irish-coffee", name: "Irish Coffee", cost: 2.7, customerPrice: 4.37 },
  { id: "pina-colada", name: "Pina Colada", cost: 2.65, customerPrice: 4.32 },
  { id: "tequila-sunrise", name: "Tequila Sunrise", cost: 2.5, customerPrice: 4.17 },
  { id: "sex-on-the-beach", name: "Sex on the Beach", cost: 2.4, customerPrice: 4.07 },
  { id: "bramble", name: "Bramble", cost: 2.55, customerPrice: 4.22 },
  { id: "paloma", name: "Paloma", cost: 2.6, customerPrice: 4.27 },
  { id: "penicillin", name: "Penicillin", cost: 2.85, customerPrice: 4.52 },
];
