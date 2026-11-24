import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { navigation } from "../data/site";
import { useSiteContent } from "../data/SiteContentContext";

const mainNavigation = navigation.filter((item) => item.href !== "/contact");
const contactNavigation = navigation.find((item) => item.href === "/contact");

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { content } = useSiteContent();
  const { site } = content;

  return (
    <header className="site-header">
      <nav
        className="primary-navigation primary-navigation-desktop"
        aria-label="Navigation principale"
      >
        {mainNavigation.map((item) => (
          <NavLink
            key={item.href}
            className={({ isActive }) =>
              `nav-link${isActive ? " is-active" : ""}`
            }
            to={item.href}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Link
        className="brand"
        to="/"
        aria-label={`${site.name}, accueil`}
        onClick={() => setMenuOpen(false)}
      >
        <span className="brand-name">{site.name}</span>
        <span className="brand-subtitle">{site.subtitle}</span>
      </Link>

      <div className="site-header-actions">
        {contactNavigation && (
          <NavLink
            className={({ isActive }) =>
              `nav-link nav-contact-link${isActive ? " is-active" : ""}`
            }
            to={contactNavigation.href}
          >
            {contactNavigation.label}
            <ArrowUpRight size={15} aria-hidden="true" />
          </NavLink>
        )}
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>

      <nav
        className={`primary-navigation primary-navigation-mobile${menuOpen ? " is-open" : ""}`}
        id="primary-navigation"
        aria-label="Navigation mobile"
      >
        {navigation.map((item) => (
          <NavLink
            key={item.href}
            className={({ isActive }) =>
              `nav-link${isActive ? " is-active" : ""}${
                item.href === "/contact" ? " nav-contact-link" : ""
              }`
            }
            to={item.href}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
            {item.href === "/contact" && (
              <ArrowUpRight size={15} aria-hidden="true" />
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
