// Apart from account.ts so a form can show them without loading Zod and uuid

export const usernameLength = { minimum: 3, maximum: 32 } as const;

export const displayNameMaxLength = 60;

// What a valid username looks like, for the field's hint and its error alike
export const usernameRule = `${usernameLength.minimum}-${usernameLength.maximum} ký tự, chỉ gồm chữ không dấu, số và . _ -`;
