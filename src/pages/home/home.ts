import htmlContent from "./index.html?raw"
import {counterComponent} from "../../components/counter/counter.ts"

export function getHomePage(): string {
  // Injeta a string do componente no placeholder do HTML
  const pageContent = htmlContent.replace(
    '<!--CONTEUDO-->', 
    counterComponent
  );
  
  return pageContent;
}