#version 450

layout (set = 1, binding = 0) uniform sampler2D samplerColorMap;
layout (set = 1, binding = 1) uniform sampler2D samplerMetallicRoughnessMap;
layout (set = 1, binding = 2) uniform sampler2D samplerNormalMap;

layout (location = 0) in vec3 inNormal;
layout (location = 1) in vec3 inColor;
layout (location = 2) in vec3 inWorldPos;
layout (location = 3) in vec2 inUV;
layout (location = 4) in vec4 inTangent;

layout (set = 0, binding = 0) uniform UBOScene
{
	mat4 projection;
	mat4 view;
	vec4 lightPos;
	vec4 viewPos;
} uboScene;

layout (location = 0) out vec4 outFragColor;

#define PI 3.1415926535897932384626433832795

float D_GGX(float dotNH, float roughness) {
	float alpha = roughness * roughness;
	float alpha2 = alpha * alpha;
	float denom = dotNH * dotNH * (alpha2 - 1.0) + 1.0;
	return alpha2 / (PI * denom * denom);
}

float G_SchlicksmithGGX(float dotNL, float dotNV, float roughness) {
	float r = (roughness + 1.0);
	float k = r * r / 8.0;
	float GL = dotNL / (dotNL * (1.0 - k) + k);
	float GV = dotNV / (dotNV * (1.0 - k) + k);
	return GL * GV;
}

vec3 F_Schlick(float cosTheta, vec3 F0) {
	return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

vec3 F_SchlickR(float cosTheta, vec3 F0, float roughness) {
	return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}

vec3 specularContribution(vec3 baseColor, vec3 L, vec3 V, vec3 N, vec3 F0, float metallic, float roughness) {
	vec3 H = normalize(L + V);
	float dotNH = clamp(dot(N, H), 0.0, 1.0);
	float dotNV = clamp(dot(N, V), 0.0, 1.0);
	float dotNL = clamp(dot(N, L), 0.0, 1.0);

	vec3 color = vec3(0.0);

	if (dotNL > 0.0) {
		float D = D_GGX(dotNH, roughness);
		float G = G_SchlicksmithGGX(dotNL, dotNV, roughness);
		vec3 F = F_Schlick(dotNV, F0);
		vec3 spec = D * F * G / (4.0 * dotNL * dotNV + 0.001);
		vec3 kD = (vec3(1.F) - F) * (1.0 - metallic);
		color += (kD * baseColor / PI + spec) * dotNL;
	}

	return color;
}

vec3 calculateNormal() {
	vec3 tangentNormal = texture(samplerNormalMap, inUV).xyz * 2.0 - 1.0;

	vec3 N = normalize(inNormal);
	vec3 T = normalize(inTangent.xyz);
	vec3 B = normalize(cross(N, T));
	mat3 TBN = mat3(T, B, N);
	return normalize(TBN * tangentNormal);
}

void main()
{
	vec3 N = calculateNormal();
	vec3 L = normalize(uboScene.lightPos.xyz - inWorldPos);
	vec3 V = normalize(uboScene.viewPos.xyz - inWorldPos);
	vec3 R = reflect(-V, N);

	float metallic = texture(samplerMetallicRoughnessMap, inUV).b;
	float roughness = texture(samplerMetallicRoughnessMap, inUV).g;

	vec3 baseColor = texture(samplerColorMap, inUV).rgb * inColor.xyz;

	vec3 F0 = vec3(0.04);
	F0 = mix(F0, baseColor, metallic);

	vec3 Lo = specularContribution(baseColor, L, V, N, F0, metallic, roughness);

	float ao = texture(samplerMetallicRoughnessMap, inUV).r;

	vec3 F = F_SchlickR(max(dot(N, V), 0.0), F0, roughness);
	vec3 kD = 1.0 - F;
	kD *= 1.0 - metallic;
	vec3 ambient = kD * baseColor * ao;

	vec3 color = ambient + Lo;
	color = pow(color, vec3(1.0 / 2.2));

	outFragColor = vec4(color, 1.0);
}
