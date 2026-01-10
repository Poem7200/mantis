---
name: mantis-base
description: mantis项目 基础规范
---

# 项目基础规范

## 核心技术栈和版本

- 框架：NestJS v11（严格模式）
- ORM：TypeORM + PostgreSQL
- 环境：Docker（Compose）
- 爬虫：Playwright（Browsers in Docker）

## 强力约束

### 命名和结构

- **文件命名**: 必须使用 `[name].[type].ts` 格式，例如 `job-crawler.service.ts`。
- **目录**: 遵循模块化结构 `src/modules/[module-name]/`。
- **导出**: 禁止使用 `export default`，必须使用具名导出。

### 2.2 TypeScript & 常量

- **禁用Any**: 严禁 `any`。如果类型复杂，定义 `interface` 或 `type`。
- **常量**: 禁止魔法值（包括config的默认值）。检测到魔法值时，必须提醒我或自动将其移动至 `src/config/constants.ts`。
- **返回类型**: 所有公共方法必须显式声明返回类型（例如 `Promise<User>`），严禁依赖推导。

### 2.3 函数简洁性 (20行准则)

- **逻辑切分**: 如果函数超过 20 行，必须拆分子私有方法或抽取工具类。
- **重构**: 始终优先考虑将业务逻辑下沉到 Service，将数据解析逻辑下沉到 Transformer。

## 3. 代码样板

### 3.1 Controller 规范

```typescript
@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() createJobDto: CreateJobDto): Promise<JobResponseDto> {
    return await this.jobService.create(createJobDto);
  }
}
```

### 3.2 Service 规范

```typescript
@Injectable()
export class JobService {
  /**
   * 必须包含 JSDoc 注释说明业务逻辑
   */
  async findActiveJobs(): Promise<JobEntity[]> {
    // 逻辑必须保持单一
  }
}
```

## 自动化指令 (Auto-Trigger)

- 当我要求创建一个新功能时，请自动生成对应的 Module, Controller, Service 和 DTO。
- 每次生成代码后，检查是否符合 JSDoc 注释要求。
