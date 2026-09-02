export const colors = {
    primary: '#1F6B4F',
    background: '#FAF7EF',
    surface: '#FFFFFF',
    text: '#17201C',
    textSecondary: '#66736C',
    border: '#E3E8E5',
    success: '#2E9B68',
    warning: '#D99A2B',
    error: '#D64545'
}

export const typography = {
    body: 16,
    small: 14,
    heading: 28,

    smallLineHeight: 20,
    bodyLineHeight: 24,
    headingLineHeight: 34
}

export const fontWeight = {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
}

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
}

export const size = {
    buttonHeight: 48,
    inputHeight: 48,

    iconSmall: 16,
    iconMedium: 20,
    iconLarge: 24
}

export const shadow = {
    sm: {
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: {
            width: 0,
            height: 2
        }
    },

    md: {
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 4
        }
    }
};

