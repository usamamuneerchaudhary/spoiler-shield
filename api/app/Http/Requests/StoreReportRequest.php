<?php

namespace App\Http\Requests;

use App\Enums\ReportKind;
use App\Support\Catalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $catalog = app(Catalog::class);
        $pack = $this->input('pack');
        $maxChapter = is_string($pack) && $catalog->has($pack) ? $catalog->chapterCount($pack) : 1;

        return [
            'kind' => ['required', Rule::enum(ReportKind::class)],
            'pack' => ['required', 'string', Rule::in($catalog->ids())],
            'chapter' => ['nullable', 'integer', 'min:1', 'max:'.$maxChapter],
            'text' => ['required', 'string', 'max:500'],
            'page_url' => ['nullable', 'string', 'max:2048', 'url:http,https'],
            'site' => ['nullable', 'string', Rule::in(config('spoiler_shield.sites'))],
            'note' => ['nullable', 'string', 'max:300'],
            'extension_version' => ['nullable', 'string', 'max:32', 'regex:/^\d+\.\d+\.\d+$/'],
            'list_version' => ['nullable', 'string', 'max:32', 'alpha_num'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'pack.in' => 'Spoiler Shield doesn\'t have a list for that game or show yet.',
            'chapter.max' => 'That chapter doesn\'t exist in this game or show.',
        ];
    }
}
