
type BaseType = "string" | "boolean" | "integer" | "number";

export type BaseJSONSchemaType<T extends BaseType | BaseType[]> = {
    type: T;
    description?: string;
    enum?: T[];
};

export type ArrayJSONSchemaType = {
    type: "array";
    description?: string;
    minItems?: number;
    maxItems?: number;
    items?: BaseJSONSchemaType<BaseType | BaseType[]> | BaseJSONSchemaType<BaseType | BaseType[]>[];
};

export type ObjectJSONSchemaType = {
    type: "object";
    properties?: Record<string, JSONSchemaType>;
    description?: string;
    required?: string[];
    additionalProperties?: boolean;
};

export type JSONSchemaType = BaseJSONSchemaType<BaseType | BaseType[]> | ArrayJSONSchemaType | ObjectJSONSchemaType;

export type Message = {
    role: "system" | "user" | "assistant",
    content: string
}

export type ResponseFormatJsonObject = {
    type: "json_object",
}

export type JsonSchemaFormat = {
    name: string
    strict: boolean
    schema: JSONSchemaType
}

export type ResponseFormatJsonSchema = {
    type: "json_schema",
    schema: JsonSchemaFormat
}

type ResponseFormat = ResponseFormatJsonSchema | ResponseFormatJsonObject

export type Payload = {
    model: string,
    messages: Message[],
    response_format?: ResponseFormat,
    stream?: boolean
}

export type ResponseData = {
    title: string,
    content: string,
    options: string[]
}
