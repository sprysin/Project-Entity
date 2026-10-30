import { Attribute } from '../../types';
import airIcon from '../../assets/attributes/Air_Attribute.svg';
import darkIcon from '../../assets/attributes/Dark_Attribute.svg';
import earthIcon from '../../assets/attributes/Earth_Attribute.svg';
import lightIcon from '../../assets/attributes/Light_Attribute.svg';
import normalIcon from '../../assets/attributes/Normal_Attribute.svg';
import './AttributeIcon.css';

const customIcons: Partial<Record<Attribute, string>> = {
    [Attribute.AIR]: airIcon,
    [Attribute.DARK]: darkIcon,
    [Attribute.EARTH]: earthIcon,
    [Attribute.LIGHT]: lightIcon,
    [Attribute.NORMAL]: normalIcon,
};

const fontIcons: Partial<Record<Attribute, string>> = {
    [Attribute.FIRE]: 'fa-fire',
    [Attribute.WATER]: 'fa-droplet',
    [Attribute.ELECTRIC]: 'fa-bolt',
};

export function AttributeIcon({ attribute = Attribute.NORMAL }: { attribute?: Attribute }) {
    const icon = customIcons[attribute];
    return icon
        ? <span aria-hidden="true" className="attribute-icon" style={{ maskImage: `url("${icon}")`, WebkitMaskImage: `url("${icon}")` }} />
        : <i aria-hidden="true" className={`fa-solid ${fontIcons[attribute]}`} />;
}
